import { Test, TestingModule } from '@nestjs/testing'; // @nestjs/testing ^10.x
import { describe, beforeEach, it, expect, jest } from '@jest/globals'; // @jest/globals ^29.x
import { of } from 'rxjs'; // rxjs ^7.x
import { loadtest } from 'loadtest'; // loadtest ^5.x

import { DiscoveryService } from '../discovery.service';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { GoogleWorkspaceService } from '../../integration/services/google-workspace.service';
import { StripeService } from '../../integration/services/stripe.service';
import { SubscriptionStatus, BillingCycle } from '../interfaces/subscription.interface';

describe('DiscoveryService', () => {
    let service: DiscoveryService;
    let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
    let googleWorkspaceService: jest.Mocked<GoogleWorkspaceService>;
    let stripeService: jest.Mocked<StripeService>;
    let cacheManager: any;

    const mockUUID = '123e4567-e89b-12d3-a456-426614174000';
    const mockDate = new Date('2024-01-01');

    const mockSubscription = {
        id: mockUUID,
        organizationId: mockUUID,
        name: 'Test Subscription',
        description: 'Test Description',
        provider: 'Test Provider',
        cost: 99.99,
        billingCycle: BillingCycle.MONTHLY,
        renewalDate: mockDate,
        status: SubscriptionStatus.ACTIVE,
        totalLicenses: 100,
        usedLicenses: 75,
        metadata: {},
        lastSyncedAt: mockDate,
        createdAt: mockDate,
        updatedAt: mockDate
    };

    beforeEach(async () => {
        const mockCache = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn()
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DiscoveryService,
                {
                    provide: SubscriptionRepository,
                    useValue: {
                        findByOrganizationId: jest.fn(),
                        findUpcomingRenewals: jest.fn(),
                        findByStatus: jest.fn(),
                        findUnderUtilized: jest.fn(),
                        findOneOrFail: jest.fn(),
                        findUsagePatterns: jest.fn()
                    }
                },
                {
                    provide: GoogleWorkspaceService,
                    useValue: {
                        fetchData: jest.fn(),
                        fetchUsageMetrics: jest.fn()
                    }
                },
                {
                    provide: StripeService,
                    useValue: {
                        fetchData: jest.fn(),
                        fetchTransactionHistory: jest.fn()
                    }
                },
                {
                    provide: 'CACHE_MANAGER',
                    useValue: mockCache
                }
            ]
        }).compile();

        service = module.get<DiscoveryService>(DiscoveryService);
        subscriptionRepository = module.get(SubscriptionRepository);
        googleWorkspaceService = module.get(GoogleWorkspaceService);
        stripeService = module.get(StripeService);
        cacheManager = mockCache;
    });

    describe('discoverSubscriptions', () => {
        it('should discover subscriptions for an organization', (done) => {
            const mockSubscriptions = [mockSubscription];
            subscriptionRepository.findByOrganizationId.mockResolvedValue([mockSubscriptions, 1]);
            cacheManager.get.mockResolvedValue(null);

            service.discoverSubscriptions(mockUUID).subscribe({
                next: (result) => {
                    expect(result).toEqual(mockSubscriptions);
                    expect(subscriptionRepository.findByOrganizationId).toHaveBeenCalledWith(
                        mockUUID,
                        expect.any(Object)
                    );
                    expect(cacheManager.set).toHaveBeenCalled();
                    done();
                },
                error: done
            });
        });

        it('should return cached subscriptions when available', (done) => {
            const cachedSubscriptions = [mockSubscription];
            cacheManager.get.mockResolvedValue(cachedSubscriptions);

            service.discoverSubscriptions(mockUUID).subscribe({
                next: (result) => {
                    expect(result).toEqual(cachedSubscriptions);
                    expect(subscriptionRepository.findByOrganizationId).not.toHaveBeenCalled();
                    done();
                },
                error: done
            });
        });

        it('should handle discovery errors gracefully', (done) => {
            subscriptionRepository.findByOrganizationId.mockRejectedValue(new Error('Discovery failed'));
            cacheManager.get.mockResolvedValue(null);

            service.discoverSubscriptions(mockUUID).subscribe({
                error: (error) => {
                    expect(error.message).toBe('Subscription discovery failed');
                    done();
                }
            });
        });
    });

    describe('analyzeUsagePatterns', () => {
        const mockAnalysisOptions = {
            timeframe: 30,
            utilizationThreshold: 80,
            includeInactive: false
        };

        it('should analyze subscription usage patterns', async () => {
            subscriptionRepository.findOneOrFail.mockResolvedValue(mockSubscription);
            cacheManager.get.mockResolvedValue(null);

            const result = await service.analyzeUsagePatterns(mockUUID, mockAnalysisOptions);

            expect(result).toHaveProperty('subscriptionId', mockUUID);
            expect(result).toHaveProperty('utilizationRate');
            expect(result).toHaveProperty('costPerUser');
            expect(result).toHaveProperty('recommendations');
            expect(result).toHaveProperty('trends');
            expect(cacheManager.set).toHaveBeenCalled();
        });

        it('should return cached analysis when available', async () => {
            const cachedAnalysis = {
                subscriptionId: mockUUID,
                utilizationRate: 75,
                costPerUser: 1.33,
                recommendations: ['Test recommendation'],
                trends: { averageUtilization: 80 },
                lastUpdated: mockDate
            };
            cacheManager.get.mockResolvedValue(cachedAnalysis);

            const result = await service.analyzeUsagePatterns(mockUUID, mockAnalysisOptions);

            expect(result).toEqual(cachedAnalysis);
            expect(subscriptionRepository.findOneOrFail).not.toHaveBeenCalled();
        });

        it('should handle analysis errors gracefully', async () => {
            subscriptionRepository.findOneOrFail.mockRejectedValue(new Error('Analysis failed'));
            cacheManager.get.mockResolvedValue(null);

            await expect(service.analyzeUsagePatterns(mockUUID, mockAnalysisOptions))
                .rejects
                .toThrow('Usage analysis failed');
        });
    });

    describe('Performance Tests', () => {
        it('should handle concurrent discovery requests efficiently', (done) => {
            const options = {
                url: 'http://localhost:3000/api/discovery',
                maxRequests: 100,
                concurrency: 10,
                timeout: 5000,
                requestGenerator: (params: any, options: any, client: any, callback: any) => {
                    const request = client(options, callback);
                    request.write(JSON.stringify({ organizationId: mockUUID }));
                    return request;
                }
            };

            loadtest.loadTest(options, (error: any, result: any) => {
                if (error) {
                    done(error);
                    return;
                }
                expect(result.totalRequests).toBe(100);
                expect(result.meanLatencyMs).toBeLessThan(1000);
                expect(result.errorCodes).toEqual({});
                done();
            });
        });
    });

    describe('Integration Tests', () => {
        it('should integrate with Google Workspace for license data', async () => {
            const mockGoogleData = {
                licenses: { total: 100, used: 75 },
                lastSync: mockDate
            };
            googleWorkspaceService.fetchData.mockResolvedValue(mockGoogleData);

            const result = await service.analyzeUsagePatterns(mockUUID, {
                timeframe: 30,
                utilizationThreshold: 80,
                includeInactive: false
            });

            expect(result.utilizationRate).toBe(75);
            expect(googleWorkspaceService.fetchData).toHaveBeenCalled();
        });

        it('should integrate with Stripe for cost analysis', async () => {
            const mockStripeData = {
                charges: [{ amount: 9999, created: mockDate.getTime() / 1000 }]
            };
            stripeService.fetchData.mockResolvedValue(mockStripeData);

            const result = await service.analyzeUsagePatterns(mockUUID, {
                timeframe: 30,
                utilizationThreshold: 80,
                includeInactive: false
            });

            expect(result.costPerUser).toBeGreaterThan(0);
            expect(stripeService.fetchData).toHaveBeenCalled();
        });
    });
});
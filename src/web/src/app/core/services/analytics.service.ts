import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, map, catchError, retry, throwError, of, shareReplay } from 'rxjs'; // v7.x
import { 
    IAnalyticsMetric, 
    ICostAnalytics, 
    IUsageTrend, 
    MetricType, 
    IErrorResponse 
} from '../../shared/models/analytics.model';

/**
 * Service responsible for handling analytics-related operations including
 * usage metrics, cost analysis, data aggregation, and real-time monitoring
 */
@Injectable({
    providedIn: 'root'
})
export class AnalyticsService {
    private readonly apiUrl = '/api/v1/analytics';
    private readonly cacheTime = 300000; // 5 minutes cache
    private readonly maxRetries = 3;
    private cache = new Map<string, Observable<any>>();

    constructor(private http: HttpClient) {}

    /**
     * Creates a new analytics metric with validation and error handling
     * @param metric - The metric data to create
     * @returns Observable of the created metric
     */
    createMetric(metric: IAnalyticsMetric): Observable<IAnalyticsMetric> {
        return this.http.post<IAnalyticsMetric>(`${this.apiUrl}/metrics`, metric).pipe(
            retry(this.maxRetries),
            map(response => response),
            catchError(this.handleError)
        );
    }

    /**
     * Retrieves metrics for a specific subscription with caching
     * @param subscriptionId - The subscription ID to fetch metrics for
     * @param type - The type of metrics to retrieve
     * @param useCache - Whether to use cached data if available
     * @returns Observable of metrics array
     */
    getMetricsBySubscription(
        subscriptionId: string,
        type: MetricType,
        useCache = true
    ): Observable<IAnalyticsMetric[]> {
        const cacheKey = `metrics_${subscriptionId}_${type}`;

        if (useCache && this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        const params = new HttpParams()
            .set('subscriptionId', subscriptionId)
            .set('type', type);

        const request = this.http.get<IAnalyticsMetric[]>(`${this.apiUrl}/metrics`, { params }).pipe(
            retry(this.maxRetries),
            map(metrics => metrics),
            catchError(this.handleError),
            shareReplay(1)
        );

        if (useCache) {
            this.cache.set(cacheKey, request);
            setTimeout(() => this.cache.delete(cacheKey), this.cacheTime);
        }

        return request;
    }

    /**
     * Retrieves cost analytics data with date range validation
     * @param startDate - Start date for cost analysis
     * @param endDate - End date for cost analysis
     * @param departmentId - Optional department ID for filtering
     * @returns Observable of cost analytics data
     */
    getCostAnalytics(
        startDate: Date,
        endDate: Date,
        departmentId?: string
    ): Observable<ICostAnalytics> {
        if (startDate > endDate) {
            return throwError(() => new Error('Invalid date range'));
        }

        let params = new HttpParams()
            .set('startDate', startDate.toISOString())
            .set('endDate', endDate.toISOString());

        if (departmentId) {
            params = params.set('departmentId', departmentId);
        }

        return this.http.get<ICostAnalytics>(`${this.apiUrl}/costs`, { params }).pipe(
            retry(this.maxRetries),
            map(analytics => analytics),
            catchError(this.handleError)
        );
    }

    /**
     * Retrieves usage trend analysis with real-time updates
     * @param subscriptionId - The subscription ID to analyze
     * @param type - The type of usage metric
     * @param timeframe - The timeframe in hours for trend analysis
     * @returns Observable of usage trend data
     */
    getUsageTrends(
        subscriptionId: string,
        type: MetricType,
        timeframe: number
    ): Observable<IUsageTrend> {
        if (timeframe <= 0) {
            return throwError(() => new Error('Invalid timeframe'));
        }

        const params = new HttpParams()
            .set('subscriptionId', subscriptionId)
            .set('type', type)
            .set('timeframe', timeframe.toString());

        return this.http.get<IUsageTrend>(`${this.apiUrl}/trends`, { params }).pipe(
            retry(this.maxRetries),
            map(trends => trends),
            catchError(this.handleError)
        );
    }

    /**
     * Retrieves aggregated metrics data with comprehensive validation
     * @param subscriptionId - The subscription ID to aggregate metrics for
     * @param type - The type of metrics to aggregate
     * @param startDate - Start date for aggregation
     * @param endDate - End date for aggregation
     * @returns Observable of aggregated metrics
     */
    getAggregatedMetrics(
        subscriptionId: string,
        type: MetricType,
        startDate: Date,
        endDate: Date
    ): Observable<{ total: number; average: number }> {
        if (startDate > endDate) {
            return throwError(() => new Error('Invalid date range'));
        }

        const params = new HttpParams()
            .set('subscriptionId', subscriptionId)
            .set('type', type)
            .set('startDate', startDate.toISOString())
            .set('endDate', endDate.toISOString());

        const cacheKey = `aggregated_${subscriptionId}_${type}_${startDate}_${endDate}`;

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        const request = this.http.get<{ total: number; average: number }>(
            `${this.apiUrl}/aggregate`,
            { params }
        ).pipe(
            retry(this.maxRetries),
            map(metrics => metrics),
            catchError(this.handleError),
            shareReplay(1)
        );

        this.cache.set(cacheKey, request);
        setTimeout(() => this.cache.delete(cacheKey), this.cacheTime);

        return request;
    }

    /**
     * Handles HTTP errors with appropriate error messages
     * @param error - The HTTP error response
     * @returns Observable error with formatted message
     */
    private handleError(error: HttpErrorResponse): Observable<never> {
        let errorMessage = 'An unknown error occurred';

        if (error.error instanceof ErrorEvent) {
            // Client-side error
            errorMessage = `Error: ${error.error.message}`;
        } else {
            // Server-side error
            errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
        }

        console.error('Analytics Service Error:', errorMessage);
        return throwError(() => new Error(errorMessage));
    }

    /**
     * Clears the service cache
     */
    clearCache(): void {
        this.cache.clear();
    }
}
import { NgModule } from '@angular/core'; // v17.0.0
import { RouterModule, Routes, PreloadAllModules, RouteReuseStrategy } from '@angular/router'; // v17.0.0
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'; // v17.0.0
import { AuthGuard } from './core/auth/auth.guard';

/**
 * Custom route reuse strategy for optimizing route reuse
 * Implements intelligent component reuse based on route data configuration
 */
export class CustomRouteReuseStrategy implements RouteReuseStrategy {
  private storedRoutes = new Map<string, any>();

  shouldDetach(route: any): boolean {
    return route.data?.reuse === true;
  }

  store(route: any, handle: any): void {
    const routeKey = this.getRouteKey(route);
    if (routeKey) {
      this.storedRoutes.set(routeKey, handle);
    }
  }

  shouldAttach(route: any): boolean {
    const routeKey = this.getRouteKey(route);
    return route.data?.reuse === true && this.storedRoutes.has(routeKey);
  }

  retrieve(route: any): any {
    const routeKey = this.getRouteKey(route);
    return this.storedRoutes.get(routeKey);
  }

  shouldReuseRoute(future: any, curr: any): boolean {
    return future.routeConfig === curr.routeConfig;
  }

  private getRouteKey(route: any): string | null {
    if (!route.routeConfig) return null;
    return route.routeConfig.path;
  }
}

/**
 * Application routes configuration implementing role-based access control
 * and lazy loading for optimal performance
 */
export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
    data: { title: 'Home' }
  },
  {
    path: 'dashboard',
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    data: {
      title: 'Dashboard',
      roles: ['USER', 'ADMIN'],
      reuse: true
    },
    loadChildren: () => import('./features/dashboard/dashboard.module')
      .then(m => m.DashboardModule)
  },
  {
    path: 'subscriptions',
    canActivate: [AuthGuard],
    data: {
      title: 'Subscriptions',
      roles: ['USER', 'ADMIN'],
      reuse: true
    },
    loadChildren: () => import('./features/subscriptions/subscriptions.module')
      .then(m => m.SubscriptionsModule)
  },
  {
    path: 'analytics',
    canActivate: [AuthGuard],
    data: {
      title: 'Analytics',
      roles: ['FINANCE_MANAGER', 'ADMIN'],
      reuse: false
    },
    loadChildren: () => import('./features/analytics/analytics.module')
      .then(m => m.AnalyticsModule)
  },
  {
    path: 'ai-assistant',
    canActivate: [AuthGuard],
    data: {
      title: 'AI Assistant',
      roles: ['USER', 'ADMIN'],
      reuse: false
    },
    loadChildren: () => import('./features/ai-assistant/ai-assistant.module')
      .then(m => m.AIAssistantModule)
  },
  {
    path: 'settings',
    canActivate: [AuthGuard],
    data: {
      title: 'Settings',
      roles: ['ADMIN'],
      reuse: false
    },
    loadChildren: () => import('./features/settings/settings.module')
      .then(m => m.SettingsModule)
  },
  {
    path: 'notifications',
    canActivate: [AuthGuard],
    data: {
      title: 'Notifications',
      roles: ['USER', 'ADMIN'],
      reuse: false
    },
    loadChildren: () => import('./features/notifications/notifications.module')
      .then(m => m.NotificationsModule)
  },
  {
    path: 'login',
    loadChildren: () => import('./features/auth/auth.module')
      .then(m => m.AuthModule),
    data: { title: 'Login' }
  },
  {
    path: 'unauthorized',
    loadChildren: () => import('./features/errors/errors.module')
      .then(m => m.ErrorsModule),
    data: { title: 'Unauthorized Access' }
  },
  {
    path: '**',
    redirectTo: 'dashboard',
    data: { title: 'Not Found' }
  }
];

/**
 * Main routing module implementing advanced routing features
 * and optimized loading strategies
 */
@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: PreloadAllModules,
      scrollPositionRestoration: 'enabled',
      anchorScrolling: 'enabled',
      paramsInheritanceStrategy: 'always',
      relativeLinkResolution: 'corrected',
      initialNavigation: 'enabledBlocking',
      onSameUrlNavigation: 'reload',
      errorHandler: (error: any) => {
        console.error('Router navigation error:', error);
      }
    }),
    BrowserAnimationsModule
  ],
  exports: [RouterModule],
  providers: [
    {
      provide: RouteReuseStrategy,
      useClass: CustomRouteReuseStrategy
    }
  ]
})
export class AppRoutingModule {}
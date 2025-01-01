import { NgModule } from '@angular/core'; // v17.0.0
import { CommonModule } from '@angular/common'; // v17.0.0
import { RouterModule } from '@angular/router'; // v17.0.0
import { ChangeDetectionStrategy } from '@angular/core'; // v17.0.0

// Feature components
import { AIAssistantComponent } from './ai-assistant.component';
import { ChatInterfaceComponent } from './components/chat-interface/chat-interface.component';
import { InsightCardComponent } from './components/insight-card/insight-card.component';

// Shared module with common components and utilities
import { SharedModule } from '../../shared/shared.module';

/**
 * Feature module for the AI Assistant functionality
 * Implements the conversational interface with intelligent insights
 * as specified in section 1.2 and 6.4 of the technical specifications.
 * 
 * @version 1.0.0
 */
@NgModule({
  declarations: [
    AIAssistantComponent,
    ChatInterfaceComponent,
    InsightCardComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    RouterModule.forChild([
      {
        path: '',
        component: AIAssistantComponent,
        data: { 
          title: 'AI Assistant',
          preload: true,
          permissions: ['ai.access'],
          breadcrumb: 'AI Assistant'
        }
      }
    ])
  ],
  exports: [
    // Export main component for use in other modules
    AIAssistantComponent
  ],
  providers: [
    // Provide enhanced error handling for AI-specific errors
    {
      provide: 'AI_ERROR_HANDLER',
      useClass: AIAssistantComponent,
      multi: true
    }
  ]
})
export class AIAssistantModule {
  /**
   * Module name for logging and debugging
   */
  static readonly moduleName: string = 'AIAssistantModule';

  /**
   * Tracks number of module instances for memory management
   */
  private static instanceCount: number = 0;

  constructor() {
    AIAssistantModule.instanceCount++;
    
    // Log module initialization in non-production environments
    if (!environment.production) {
      console.debug(
        `[${AIAssistantModule.moduleName}] Initialized instance ${AIAssistantModule.instanceCount}`
      );
    }

    // Verify required dependencies
    this.validateDependencies();
  }

  /**
   * Validates required module dependencies
   * @private
   */
  private validateDependencies(): void {
    // Ensure required Angular Material modules are available
    const requiredModules = [
      'CommonModule',
      'SharedModule',
      'RouterModule'
    ];

    const missingModules = requiredModules.filter(module => 
      !Reflect.has(this, module)
    );

    if (missingModules.length > 0) {
      throw new Error(
        `[${AIAssistantModule.moduleName}] Missing required modules: ${missingModules.join(', ')}`
      );
    }
  }
}
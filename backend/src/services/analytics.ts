import { FastifyBaseLogger } from 'fastify';

/**
 * AnalyticsService provides a structured way to log business events.
 * It uses the application's logger to emit JSON logs that can be
 * ingested by log management tools.
 */
class AnalyticsService {
    private logger?: FastifyBaseLogger;

    /**
     * Initialize the service with the application logger.
     */
    init(logger: FastifyBaseLogger) {
        this.logger = logger;
    }

    /**
     * Capture a business event.
     * @param eventName The name of the event (e.g., 'webhook_received')
     * @param properties Key-value pairs of metadata for the event
     */
    track(eventName: string, properties: Record<string, any> = {}) {
        if (!this.logger) {
            // Silently fail if not initialized to avoid breaking logic
            return;
        }

        this.logger.info({
            analytics_event: true,
            event_name: eventName,
            ...properties,
        }, `[ANALYTICS] ${eventName}`);
    }

    /**
     * Placeholder for flushing logs if needed (not required for standard logging)
     */
    async shutdown() {
        // No-op for now as we use the main logger
    }
}

export const analytics = new AnalyticsService();

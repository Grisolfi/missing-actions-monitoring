export const dashboardSummarySchema = {
    querystring: {
        type: 'object',
        properties: {
            start_date: { type: 'string', format: 'date-time' },
            end_date: { type: 'string', format: 'date-time' },
            repository: { type: 'string' }
        }
    },
    response: {
        200: {
            type: 'object',
            properties: {
                current_state: {
                    type: 'object',
                    properties: {
                        running: { type: 'integer' },
                        queued: { type: 'integer' }
                    }
                },
                aggregates: {
                    type: 'object',
                    properties: {
                        average_wait_time: { type: 'number' },
                        average_duration: { type: 'number' },
                        total_executions: { type: 'integer' },
                        success_rate: { type: 'number' }
                    }
                },
                time_series: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            timestamp: { type: 'string', format: 'date-time' },
                            success_rate: { type: 'number' },
                            average_duration: { type: 'number' }
                        }
                    }
                }
            }
        }
    }
};

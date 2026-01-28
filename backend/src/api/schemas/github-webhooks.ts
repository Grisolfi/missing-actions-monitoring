/**
 * JSON Schema for GitHub Webhooks (workflow_run and workflow_job)
 * This schema is used by Fastify's native validation engine (Ajv)
 * to ensure incoming payloads match our expected contract.
 */
export const githubWebhookSchema = {
    body: {
        type: 'object',
        required: ['repository'],
        properties: {
            repository: {
                type: 'object',
                required: ['full_name'],
                properties: {
                    full_name: { type: 'string' }
                }
            }
        },
        // We validate based on which event shape is arriving
        oneOf: [
            {
                // Schema for workflow_run
                type: 'object',
                required: ['workflow_run'],
                properties: {
                    workflow_run: {
                        type: 'object',
                        required: ['id', 'status', 'name', 'created_at'],
                        properties: {
                            id: { type: 'integer' },
                            status: { type: 'string' },
                            conclusion: { type: ['string', 'null'] },
                            name: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                            run_started_at: { type: 'string', format: 'date-time' },
                            updated_at: { type: 'string', format: 'date-time' }
                        }
                    },
                    workflow_job: false // Ensure no job data is present in run event
                }
            },
            {
                // Schema for workflow_job
                type: 'object',
                required: ['workflow_job'],
                properties: {
                    workflow_job: {
                        type: 'object',
                        required: ['id', 'run_id', 'status', 'name', 'started_at'],
                        properties: {
                            id: { type: 'integer' },
                            run_id: { type: 'integer' },
                            status: { type: 'string' },
                            conclusion: { type: ['string', 'null'] },
                            name: { type: 'string' },
                            started_at: { type: 'string', format: 'date-time' },
                            completed_at: { type: 'string', format: 'date-time' }
                        }
                    },
                    workflow_run: false // Ensure no run data is present in job event
                }
            }
        ]
    }
};

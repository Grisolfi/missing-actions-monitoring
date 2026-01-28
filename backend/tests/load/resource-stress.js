import autocannon from 'autocannon';

const targetUrl = process.env.TARGET_URL || 'http://localhost:3000';
const duration = 20; // seconds

console.log(`Starting resource stress test against ${targetUrl}...`);
console.log(`Goal: Saturate Docker resource limits (CPU/RAM).`);

const instance = autocannon({
    url: `${targetUrl}/health`, // Check health endpoint for raw throughput
    connections: 200, // High concurrency to force context switching
    pipelining: 10, // Pipeline requests to maximize pressure
    duration: duration,
}, (err, result) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(autocannon.printResult(result));
    console.log('Stress test complete.');
});

autocannon.track(instance, { renderProgressBar: true });

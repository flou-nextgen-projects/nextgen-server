module.exports = {
    apps: [{
        name: 'flokapture-job-api',
        script: 'dist/server-app.js',
        watch: [
            'dist/**/*'
        ]
    }]
};
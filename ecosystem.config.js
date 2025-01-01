module.exports = {
    apps: [{
        name: 'nextgen server',
        script: 'dist/server-app.js',
        watch: [
            'dist/**/*'
        ]
    }]
};
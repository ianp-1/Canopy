
(async () => {
    try {
        const auth = await import('./src/app/actions/auth');
        console.log('Successfully imported auth.ts');
    } catch (error) {
        console.error('Failed to import auth.ts:', error);
    }
})();

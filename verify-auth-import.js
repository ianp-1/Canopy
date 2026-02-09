
try {
    require('./src/app/actions/auth.ts');
    console.log('Successfully imported auth.ts');
} catch (error) {
    console.error('Failed to import auth.ts:', error);
}

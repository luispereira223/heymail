import { initializeDatabase } from './database.js';

// Run this script to initialize the database
function main() {
  console.log('Initializing database...');
  
  try {
    const db = initializeDatabase();
    console.log('✅ Database initialized successfully');
    
    // Create a default admin user if needed (optional)
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    console.log(`Database has ${userCount.count} users`);
    
    db.close();
    console.log('Database connection closed');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
import { useEffect } from 'react';
import { DatesheetGenerator } from './components/DatesheetGenerator';
import { db } from './lib/firebase';
import { doc, getDocFromServer } from 'firebase/firestore';

export default function App() {
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  return <DatesheetGenerator />;
}

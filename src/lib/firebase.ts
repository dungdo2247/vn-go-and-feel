import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, doc, getDocFromServer, collection, 
  setDoc, getDoc, getDocs, deleteDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, 
  GoogleAuthProvider, signInWithPopup, signOut, User 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { TravelItinerary, JournalEntry } from '../types/travel';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore (using specific database ID if provided)
export const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Persistent Guest ID for visitors without requiring Anonymous Auth enabled
export function getOrCreateGuestId(): string {
  try {
    let guestId = localStorage.getItem('vietnam_travel_guest_id');
    if (!guestId) {
      guestId = 'guest_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      localStorage.setItem('vietnam_travel_guest_id', guestId);
    }
    return guestId;
  } catch {
    return 'guest_device_' + Date.now();
  }
}

// Test Connection on Boot as mandated by Firebase Skill
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline. Check network connection.');
    }
  }
}

// Initialize Auth Listener with graceful fallback for unauthenticated guests
export function initAuthListener(onUserChanged: (user: User | null) => void) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      onUserChanged(user);
    } else {
      // Attempt anonymous auth if configured, but do not error out if admin-restricted
      try {
        await signInAnonymously(auth);
      } catch {
        // Anonymous authentication is disabled in Firebase Console (auth/admin-restricted-operation)
        // Fall back gracefully to guest ID mode
        onUserChanged(null);
      }
    }
  });
}

// Sign in with Google for multi-device sync
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google Sign In error:', error);
    throw error;
  }
}

export async function logOut() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// 1. Sync Visited Provinces to Cloud Firestore
export async function saveVisitedProvincesToCloud(userId: string, visitedProvinces: string[]) {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      uid: userId,
      visitedProvinces,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    console.warn('Could not save visited provinces to Firestore:', error);
  }
}

export async function loadVisitedProvincesFromCloud(userId: string): Promise<string[] | null> {
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists() && snap.data()?.visitedProvinces) {
      return snap.data().visitedProvinces as string[];
    }
  } catch (error) {
    console.warn('Could not load visited provinces from Firestore:', error);
  }
  return null;
}

// 2. Sync Saved Itineraries to Cloud Firestore
export async function savePlanToCloud(userId: string, plan: TravelItinerary) {
  try {
    const planRef = doc(db, 'users', userId, 'plans', plan.id || `plan_${Date.now()}`);
    await setDoc(planRef, {
      ...plan,
      userId,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    console.warn('Could not save plan to Firestore:', error);
  }
}

export async function loadPlansFromCloud(userId: string): Promise<TravelItinerary[]> {
  try {
    const plansCol = collection(db, 'users', userId, 'plans');
    const snap = await getDocs(plansCol);
    const plans: TravelItinerary[] = [];
    snap.forEach((docSnap) => {
      plans.push(docSnap.data() as TravelItinerary);
    });
    return plans;
  } catch (error) {
    console.warn('Could not load plans from Firestore:', error);
    return [];
  }
}

export async function deletePlanFromCloud(userId: string, planId: string) {
  try {
    const planRef = doc(db, 'users', userId, 'plans', planId);
    await deleteDoc(planRef);
  } catch (error) {
    console.warn('Could not delete plan from Firestore:', error);
  }
}

// 3. Sync Photo Journals to Cloud Firestore
export async function saveJournalToCloud(userId: string, entry: JournalEntry) {
  try {
    const journalRef = doc(db, 'users', userId, 'journals', entry.id);
    await setDoc(journalRef, {
      ...entry,
      userId,
      createdAt: new Date().toISOString(),
    }, { merge: true });

    // Also save to publicJournals
    const publicRef = doc(db, 'publicJournals', entry.id);
    await setDoc(publicRef, {
      ...entry,
      userId,
      createdAt: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    console.warn('Could not save journal to Firestore:', error);
  }
}

export async function loadJournalsFromCloud(userId: string): Promise<JournalEntry[]> {
  try {
    const journalsCol = collection(db, 'users', userId, 'journals');
    const snap = await getDocs(journalsCol);
    const journals: JournalEntry[] = [];
    snap.forEach((docSnap) => {
      journals.push(docSnap.data() as JournalEntry);
    });
    return journals;
  } catch (error) {
    console.warn('Could not load journals from Firestore:', error);
    return [];
  }
}

export async function deleteJournalFromCloud(userId: string, journalId: string) {
  try {
    const journalRef = doc(db, 'users', userId, 'journals', journalId);
    await deleteDoc(journalRef);
    const publicRef = doc(db, 'publicJournals', journalId);
    await deleteDoc(publicRef);
  } catch (error) {
    console.warn('Could not delete journal from Firestore:', error);
  }
}

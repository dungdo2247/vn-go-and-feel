import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, doc, collection, 
  setDoc, getDoc, getDocs, deleteDoc 
} from 'firebase/firestore';
import { 
  getAuth, onAuthStateChanged, 
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

// A signed-in Firebase UID is the only owner identity.
export function initAuthListener(onUserChanged: (user: User | null) => void) {
  return onAuthStateChanged(auth, onUserChanged);
}
function assertOwner(userId: string) {
  if (!userId || auth.currentUser?.isAnonymous || auth.currentUser?.uid !== userId) {
    throw new Error('Vui lòng đăng nhập đúng tài khoản để quản lý dữ liệu.');
  }
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
    assertOwner(userId);
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
    assertOwner(userId);
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
    assertOwner(userId);
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
    assertOwner(userId);
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
    assertOwner(userId);
    const planRef = doc(db, 'users', userId, 'plans', planId);
    await deleteDoc(planRef);
  } catch (error) {
    console.warn('Could not delete plan from Firestore:', error);
  }
}

// 3. Sync Photo Journals to Cloud Firestore
export async function saveJournalToCloud(userId: string, entry: JournalEntry) {
  try {
    assertOwner(userId);
    const journalRef = doc(db, 'users', userId, 'journals', entry.id);
    await setDoc(journalRef, {
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
    assertOwner(userId);
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
    assertOwner(userId);
    const journalRef = doc(db, 'users', userId, 'journals', journalId);
    await deleteDoc(journalRef);
  } catch (error) {
    console.warn('Could not delete journal from Firestore:', error);
  }
}

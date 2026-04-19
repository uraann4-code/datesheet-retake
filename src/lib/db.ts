import { db, auth } from './firebase';
import { collection, doc, writeBatch, getDocs, updateDoc, setDoc, getDoc, query, where, deleteDoc } from 'firebase/firestore';
import { ApprovableRecord } from '../components/ApprovalPanel';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const createUserProfile = async (user: any) => {
  const path = `users/${user.uid}`;
  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        email: user.email,
        role: 'user',
        createdAt: new Date().toISOString()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const createWorkspace = async (workspaceId: string, name: string, records: ApprovableRecord[]) => {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const path = `workspaces/${workspaceId}`;

  try {
    await setDoc(doc(db, 'workspaces', workspaceId), {
      name,
      ownerId: uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const recordsRef = collection(db, 'workspaces', workspaceId, 'records');
    const chunks = [];
    for (let i = 0; i < records.length; i += 400) {
      chunks.push(records.slice(i, i + 400));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      for (const record of chunk) {
        const docRef = doc(recordsRef, record._id);
        batch.set(docRef, {
          workspaceId,
          _status: record._status,
          originalData: JSON.stringify(record)
        });
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const updateRecordStatus = async (workspaceId: string, recordId: string, status: string) => {
  if (!auth.currentUser || !workspaceId) return;
  const path = `workspaces/${workspaceId}/records/${recordId}`;
  try {
    const recordRef = doc(db, 'workspaces', workspaceId, 'records', recordId);
    await updateDoc(recordRef, { _status: status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const updateMultipleRecordStatuses = async (workspaceId: string, recordIds: string[], status: string) => {
  if (!auth.currentUser || !workspaceId) return;
  const path = `workspaces/${workspaceId}/records`;
  try {
    const recordsRef = collection(db, 'workspaces', workspaceId, 'records');
    const chunks = [];
    for (let i = 0; i < recordIds.length; i += 400) {
      chunks.push(recordIds.slice(i, i + 400));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      for (const id of chunk) {
        batch.update(doc(recordsRef, id), { _status: status });
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const loadAllWorkspaces = async (): Promise<any[]> => {
  if (!auth.currentUser) return [];
  const uid = auth.currentUser.uid;
  const path = `workspaces`;
  
  try {
    const wsRef = collection(db, 'workspaces');
    const q = query(wsRef, where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const loadWorkspaceById = async (workspaceId: string): Promise<{workspaceId: string, records: ApprovableRecord[]} | null> => {
  if (!auth.currentUser || !workspaceId) return null;
  const path = `workspaces/${workspaceId}`;
  
  try {
    const recordsRef = collection(db, 'workspaces', workspaceId, 'records');
    const recordsSnap = await getDocs(recordsRef);
    
    const records = recordsSnap.docs.map(d => {
      const data = d.data();
      const parsed = JSON.parse(data.originalData);
      parsed._status = data._status;
      return parsed;
    });

    return { workspaceId, records };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const deleteWorkspace = async (workspaceId: string) => {
  if (!auth.currentUser || !workspaceId) return;
  const path = `workspaces/${workspaceId}`;
  
  try {
    // Delete all records in the subcollection first
    const recordsRef = collection(db, 'workspaces', workspaceId, 'records');
    const recordsSnap = await getDocs(recordsRef);
    
    const chunks = [];
    for (let i = 0; i < recordsSnap.docs.length; i += 400) {
      chunks.push(recordsSnap.docs.slice(i, i + 400));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      for (const d of chunk) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }

    // Now delete the main document
    await deleteDoc(doc(db, 'workspaces', workspaceId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const loadLatestWorkspace = async (): Promise<{workspaceId: string, records: ApprovableRecord[]} | null> => {
  if (!auth.currentUser) return null;
  const uid = auth.currentUser.uid;
  const path = `workspaces`;
  
  try {
    const wsRef = collection(db, 'workspaces');
    const snap = await getDocs(wsRef);
    const userWorkspaces = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter(w => w.ownerId === uid)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (userWorkspaces.length === 0) return null;
    
    const latestWs = userWorkspaces[0];
    const recordsRef = collection(db, 'workspaces', latestWs.id, 'records');
    const recordsSnap = await getDocs(recordsRef);
    
    const records = recordsSnap.docs.map(d => {
      const data = d.data();
      const parsed = JSON.parse(data.originalData);
      parsed._status = data._status;
      return parsed;
    });

    return { workspaceId: latestWs.id, records };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, arrayUnion, Timestamp, writeBatch
} from "firebase/firestore";
import { db } from "../firebase";

// ── Users ──────────────────────────────────────────────────────────────────

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createUserProfile(uid, data) {
  await setDoc(doc(db, "users", uid), { ...data, createdAt: Timestamp.now() });
}

export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, "users", uid), data);
}

export async function getUserByUsername(username) {
  const q = query(collection(db, "users"), where("username", "==", username));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ── Groups (קבוצות) ────────────────────────────────────────────────────────

export async function createGroup(data) {
  const ref = await addDoc(collection(db, "groups"), {
    ...data,
    createdAt: Timestamp.now()
  });
  return ref.id;
}

export async function getGroup(groupId) {
  const snap = await getDoc(doc(db, "groups", groupId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateGroup(groupId, data) {
  await updateDoc(doc(db, "groups", groupId), data);
}

export async function getGroupsByCommander(commanderUid) {
  const q = query(collection(db, "groups"), where("commanderUid", "==", commanderUid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getGroupsForSoldier(uid) {
  const q = query(collection(db, "groups"), where("memberUids", "array-contains", uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Soldiers in group ─────────────────────────────────────────────────────

export async function addSoldierToGroup(groupId, soldierData) {
  const ref = await addDoc(collection(db, "groups", groupId, "soldiers"), {
    ...soldierData,
    active: true,
    addedAt: Timestamp.now()
  });
  await updateDoc(doc(db, "groups", groupId), {
    memberUids: arrayUnion(soldierData.uid || ref.id)
  });
  return ref.id;
}

export async function getSoldiersInGroup(groupId) {
  const snap = await getDocs(collection(db, "groups", groupId, "soldiers"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateSoldier(groupId, soldierId, data) {
  await updateDoc(doc(db, "groups", groupId, "soldiers", soldierId), data);
}

export async function deleteSoldier(groupId, soldierId) {
  await deleteDoc(doc(db, "groups", groupId, "soldiers", soldierId));
}

// ── Tasks / Missions ──────────────────────────────────────────────────────

export async function getTasksForGroup(groupId) {
  const snap = await getDocs(collection(db, "groups", groupId, "tasks"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addTask(groupId, taskData) {
  const ref = await addDoc(collection(db, "groups", groupId, "tasks"), taskData);
  return ref.id;
}

export async function updateTask(groupId, taskId, data) {
  await updateDoc(doc(db, "groups", groupId, "tasks", taskId), data);
}

export async function deleteTask(groupId, taskId) {
  await deleteDoc(doc(db, "groups", groupId, "tasks", taskId));
}

// ── Schedule (שיבוצים) ─────────────────────────────────────────────────────

export async function saveSchedule(groupId, scheduleData) {
  const ref = await addDoc(collection(db, "groups", groupId, "schedules"), {
    ...scheduleData,
    createdAt: Timestamp.now()
  });
  return ref.id;
}

export async function getSchedulesForGroup(groupId, startDate, endDate) {
  const q = query(
    collection(db, "groups", groupId, "schedules"),
    where("startTime", ">=", Timestamp.fromDate(startDate)),
    where("startTime", "<=", Timestamp.fromDate(endDate)),
    orderBy("startTime")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getSchedulesForSoldier(groupId, soldierUid, startDate, endDate) {
  const q = query(
    collection(db, "groups", groupId, "schedules"),
    where("assignedUids", "array-contains", soldierUid),
    where("startTime", ">=", Timestamp.fromDate(startDate)),
    where("startTime", "<=", Timestamp.fromDate(endDate)),
    orderBy("startTime")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveBulkSchedule(groupId, slots) {
  const batch = writeBatch(db);
  slots.forEach(slot => {
    const ref = doc(collection(db, "groups", groupId, "schedules"));
    batch.set(ref, { ...slot, createdAt: Timestamp.now() });
  });
  await batch.commit();
}

// ── Messages ───────────────────────────────────────────────────────────────

export async function sendMessage(groupId, messageData) {
  await addDoc(collection(db, "groups", groupId, "messages"), {
    ...messageData,
    createdAt: Timestamp.now(),
    read: false
  });
}

export async function getMessagesForUser(groupId, uid) {
  const q = query(
    collection(db, "groups", groupId, "messages"),
    where("recipientUid", "in", [uid, "all"]),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function subscribeToMessages(groupId, uid, callback) {
  const q = query(
    collection(db, "groups", groupId, "messages"),
    where("recipientUid", "in", [uid, "all"]),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ── Historical assignments (היסטוריה ראשונית) ─────────────────────────────

export async function saveHistoricalData(groupId, historyRows) {
  const batch = writeBatch(db);
  historyRows.forEach(row => {
    const ref = doc(collection(db, "groups", groupId, "history"));
    batch.set(ref, { ...row, isHistorical: true });
  });
  await batch.commit();
}

export async function getHistoryForGroup(groupId) {
  const snap = await getDocs(collection(db, "groups", groupId, "history"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

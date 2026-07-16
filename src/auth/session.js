// src/auth/session.js — singleton auth session, kept in sync with Firebase.
// idToken here is a snapshot from the last auth-state change; ID tokens expire
// hourly and a play session can outlast that, so callers that need a token for
// a network request should call getFreshIdToken() instead of reading it directly.
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase.js';

const session = {
  uid: null,
  displayName: null,
  photoURL: null,
  slotKey: null,
  idToken: null,
};

const listeners = new Set();

onAuthStateChanged(auth, async user => {
  if (user) {
    session.uid         = user.uid;
    session.displayName = user.displayName;
    session.photoURL    = user.photoURL;
    session.idToken      = await user.getIdToken();
  } else {
    session.uid = session.displayName = session.photoURL = session.idToken = session.slotKey = null;
  }
  listeners.forEach(fn => fn(session));
});

export function onSessionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getFreshIdToken() {
  return auth.currentUser ? auth.currentUser.getIdToken() : Promise.resolve(null);
}

export default session;

// src/auth/googleAuth.js — Google Sign-In via Firebase Authentication.
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from './firebase.js';

const provider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, provider).then(result => result.user);
}

export function signOutUser() {
  return signOut(auth);
}

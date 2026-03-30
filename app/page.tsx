'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { 
  LayoutDashboard, 
  Users, 
  History, 
  Cake, 
  Flag, 
  Calendar, 
  Building2, 
  LogOut,
  Menu,
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  Info,
  Loader2,
  Plus,
  Trash2,
  FileUp,
  Search,
  Filter,
  CheckCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs,
  serverTimestamp, 
  Timestamp, 
  limit, 
  where,
  writeBatch 
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { db, auth, storage } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import Papa from 'papaparse';
import { apiClient } from '@/lib/api-client';

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
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
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) errorMessage = parsed.error;
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Oops! Terjadi Kesalahan</h2>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Types ---

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

type NavItem = 'dashboard' | 'recipients' | 'history' | 'birthday' | 'hut' | 'agenda' | 'internal' | 'users' | 'templates';

interface ContactList {
  id: string;
  name: string;
  description?: string;
  createdAt: any;
}

interface Recipient {
  id: string;
  name: string;
  phone: string;
  listId: string;
  category?: string;
  region?: string;
  birthDate?: string;
  regionAnniversaryDate?: string;
  createdAt: any;
}

interface Template {
  id: string;
  name: string;
  content: string;
  category: string;
  createdAt: any;
  authorUid: string;
}

interface Broadcast {
  id: string;
  title: string;
  content: string;
  mediaUrl?: string;
  mediaType: 'text' | 'image' | 'video';
  category: string;
  status: 'pending' | 'sending' | 'completed' | 'failed' | 'scheduled' | 'draft';
  recipientCount: number;
  successCount: number;
  failedCount: number;
  createdAt: any;
  scheduledAt?: any;
  authorUid: string;
}

// --- Components ---

const Sidebar = ({ activeTab, onTabChange, user, isAdmin, permissions }: { activeTab: NavItem, onTabChange: (tab: NavItem) => void, user: User | null, isAdmin: boolean, permissions: any }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'recipients', label: 'Recipients', icon: Users },
    { id: 'templates', label: 'Templates', icon: FileUp },
    { id: 'history', label: 'History', icon: History },
  ];

  if (isAdmin) {
    menuItems.push({ id: 'users', label: 'User Management', icon: Users });
  }

  const broadcastItems = [
    { id: 'birthday', label: 'Ulang Tahun', icon: Cake, color: 'text-pink-500', bg: 'bg-pink-50' },
    { id: 'hut', label: 'HUT Daerah', icon: Flag, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'agenda', label: 'Agenda Dirjen', icon: Calendar, color: 'text-orange-500', bg: 'bg-orange-50' },
    { id: 'internal', label: 'Internal Otda', icon: Building2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  ];

  const filteredMenuItems = menuItems.filter(item => isAdmin || permissions?.[item.id] !== false);
  const filteredBroadcastItems = broadcastItems.filter(item => isAdmin || permissions?.[item.id] !== false);

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col shadow-sm z-20">
      <div className="p-6 border-b border-gray-100">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2"
        >
          <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-200">
            <Send className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">
            Kemendagri <span className="text-blue-600">Otda</span>
          </h1>
        </motion.div>
        <p className="text-[10px] text-gray-400 mt-1 font-medium tracking-widest uppercase">WA Broadcast Dashboard</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-3 px-2">Main Menu</p>
          <div className="space-y-1">
            {filteredMenuItems.map((item) => (
              <motion.button
                key={item.id}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onTabChange(item.id as NavItem)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
                  activeTab === item.id 
                    ? "bg-blue-600 text-white shadow-md shadow-blue-100" 
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon className={cn("w-4 h-4", activeTab === item.id ? "text-white" : "text-gray-400")} />
                {item.label}
              </motion.button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-3 px-2">Broadcast Types</p>
          <div className="space-y-1">
            {filteredBroadcastItems.map((item) => (
              <motion.button
                key={item.id}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onTabChange(item.id as NavItem)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
                  activeTab === item.id 
                    ? cn(item.bg, item.color, "shadow-sm") 
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon className={cn("w-4 h-4", activeTab === item.id ? item.color : "text-gray-400")} />
                {item.label}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-100 bg-gray-50/50">
        {user ? (
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border-2 border-white shadow-sm">
              <Image 
                src={user.photoURL || 'https://picsum.photos/seed/user/200/200'} 
                alt={user.displayName || ''} 
                fill
                className="object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{user.displayName}</p>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => signOut(auth)}
                className="text-[10px] font-bold text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors"
              >
                <LogOut className="w-3 h-3" />
                LOGOUT
              </motion.button>
            </div>
          </div>
        ) : (
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            Login with Google
          </motion.button>
        )}
      </div>
    </div>
  );
};

// --- Main Page ---

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<NavItem>('dashboard');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Broadcast | undefined>(undefined);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [permissions, setPermissions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [watzapStatus, setWatzapStatus] = useState<any>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const handleTabChange = (tab: NavItem) => {
    setActiveTab(tab);
    setIsCreating(false);
    setSelectedTemplate(undefined);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Test connection to Firestore as per guidelines
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
        } catch (error) {
          if(error instanceof Error && error.message.includes('the client is offline')) {
            console.error("Please check your Firebase configuration.");
          }
        }

        // Check if user is the hardcoded superadmin
        if (u.email === "sigittekno565@gmail.com" && u.emailVerified) {
          setIsAdmin(true);
          // Ensure user document exists with admin role
          try {
            const userRef = doc(db, 'users', u.uid);
            const userSnap = await getDoc(userRef).catch(err => handleFirestoreError(err, OperationType.GET, `users/${u.uid}`));
            
            if (userSnap && userSnap.exists()) {
              setPermissions(userSnap.data().permissions || null);
            } else {
              // Check if there's a pending user doc with this email
              const q = query(collection(db, 'users'), where('email', '==', u.email));
              const snap = await getDocs(q).catch(err => handleFirestoreError(err, OperationType.LIST, 'users'));
              
              if (snap && !snap.empty) {
                const pendingDoc = snap.docs[0];
                const data = pendingDoc.data();
                // "Claim" the doc by creating a new one with UID and deleting the old one (or just update the old one if we use email as ID)
                // To keep it simple, let's just update the existing doc with the UID if we were using random IDs, 
                // but here we want to use UID as the document ID for easy access.
                await setDoc(userRef, {
                  ...data,
                  displayName: u.displayName,
                  photoURL: u.photoURL,
                  updatedAt: serverTimestamp()
                }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${u.uid}`));
                
                if (pendingDoc.id !== u.uid) {
                  await deleteDoc(doc(db, 'users', pendingDoc.id)).catch(err => handleFirestoreError(err, OperationType.DELETE, `users/${pendingDoc.id}`));
                }
                setPermissions(data.permissions || null);
              } else {
                await setDoc(userRef, {
                  email: u.email,
                  displayName: u.displayName,
                  role: 'admin',
                  createdAt: serverTimestamp()
                }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${u.uid}`));
              }
            }
          } catch (e) {
            console.error("Error setting up admin user:", e);
          }
        } else {
          // Check database for role and permissions
          try {
            const userRef = doc(db, 'users', u.uid);
            let userSnap = await getDoc(userRef).catch(err => handleFirestoreError(err, OperationType.GET, `users/${u.uid}`));
            
            if (userSnap && userSnap.exists()) {
              const data = userSnap.data();
              setPermissions(data.permissions || null);
              setIsAdmin(data.role === 'admin');
            } else {
              // Check if there's a pending user doc with this email
              const q = query(collection(db, 'users'), where('email', '==', u.email));
              const snap = await getDocs(q).catch(err => handleFirestoreError(err, OperationType.LIST, 'users'));
              
              if (snap && !snap.empty) {
                const pendingDoc = snap.docs[0];
                const data = pendingDoc.data();
                await setDoc(userRef, {
                  ...data,
                  displayName: u.displayName,
                  photoURL: u.photoURL,
                  updatedAt: serverTimestamp()
                }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${u.uid}`));
                
                if (pendingDoc.id !== u.uid) {
                  await deleteDoc(doc(db, 'users', pendingDoc.id)).catch(err => handleFirestoreError(err, OperationType.DELETE, `users/${pendingDoc.id}`));
                }
                setPermissions(data.permissions || null);
                setIsAdmin(data.role === 'admin');
              } else {
                setIsAdmin(false);
                setPermissions(null);
                // Create default user doc
                await setDoc(userRef, {
                  email: u.email,
                  displayName: u.displayName,
                  role: 'user',
                  createdAt: serverTimestamp()
                }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${u.uid}`));
              }
            }
          } catch (e) {
            console.error("Error checking user status:", e);
            setIsAdmin(false);
          }
        }
      } else {
        setIsAdmin(false);
        setPermissions(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const [recipientsData, listsData, broadcastsData] = await Promise.all([
          apiClient.get('/contact-lists/all/recipients'), // Adjust endpoint as needed
          apiClient.get('/contact-lists'),
          apiClient.get('/broadcasts')
        ]);
        setRecipients(recipientsData);
        setContactLists(listsData);
        setBroadcasts(broadcastsData);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();

    // Check Watzap status via Laravel or direct
    apiClient.get('/watzap/status').then(setWatzapStatus).catch(() => setWatzapStatus({ status: 'error' }));

  }, [user]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-md w-full text-center">
          <Send className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Kemendagri Otda</h1>
          <p className="text-gray-500 mb-8">Silakan login untuk mengakses dashboard broadcast WhatsApp.</p>
          <button 
            onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            Login with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} user={user} isAdmin={isAdmin} permissions={permissions} />
        
        <main className="flex-1 overflow-y-auto relative">
          {/* Toast Notifications */}
          <div className="fixed top-6 right-6 z-50 space-y-3 pointer-events-none">
            <AnimatePresence>
              {toasts.map((toast) => (
                <motion.div
                  key={toast.id}
                  initial={{ opacity: 0, x: 50, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.9 }}
                  className={cn(
                    "pointer-events-auto px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 min-w-[300px] border",
                    toast.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-800" :
                    toast.type === 'error' ? "bg-red-50 border-red-100 text-red-800" :
                    "bg-blue-50 border-blue-100 text-blue-800"
                  )}
                >
                  {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> :
                   toast.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-500" /> :
                   <Info className="w-5 h-5 text-blue-500" />}
                  <p className="text-sm font-bold">{toast.message}</p>
                  <button 
                    onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                    className="ml-auto p-1 hover:bg-black/5 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 opacity-50" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="p-8 max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && <DashboardOverview recipients={recipients} broadcasts={broadcasts} watzapStatus={watzapStatus} />}
              {activeTab === 'recipients' && <RecipientManager recipients={recipients} contactLists={contactLists} setRecipients={setRecipients} setContactLists={setContactLists} addToast={addToast} />}
              {activeTab === 'templates' && <TemplateManager templates={templates} user={user} addToast={addToast} />}
              {activeTab === 'history' && <BroadcastHistory broadcasts={broadcasts} />}
              {activeTab === 'users' && isAdmin && <UserManager addToast={addToast} />}
              {['birthday', 'hut', 'agenda', 'internal'].includes(activeTab) && (
                isCreating ? (
                  <BroadcastForm 
                    type={activeTab as any} 
                    recipients={recipients} 
                    contactLists={contactLists}
                    user={user}
                    templates={templates}
                    template={selectedTemplate}
                    onSuccess={() => {
                      setIsCreating(false);
                      setSelectedTemplate(undefined);
                      addToast('Broadcast berhasil diproses!', 'success');
                    }}
                    onCancel={() => {
                      setIsCreating(false);
                      setSelectedTemplate(undefined);
                    }}
                    addToast={addToast}
                  />
                ) : (
                  <BroadcastList 
                    type={activeTab as any} 
                    broadcasts={broadcasts} 
                    onCreateNew={(template) => {
                      setSelectedTemplate(template);
                      setIsCreating(true);
                    }} 
                  />
                )
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

// --- Sub-Components ---

const DashboardOverview = ({ recipients, broadcasts, watzapStatus }: { recipients: Recipient[], broadcasts: Broadcast[], watzapStatus: any }) => {
  const stats = [
    { label: 'Total Recipients', value: recipients.length, icon: Users, color: 'bg-blue-500' },
    { label: 'Total Broadcasts', value: broadcasts.length, icon: Send, color: 'bg-emerald-500' },
    { label: 'Success Rate', value: broadcasts.length > 0 ? `${Math.round((broadcasts.reduce((acc, b) => acc + b.successCount, 0) / broadcasts.reduce((acc, b) => acc + b.recipientCount, 0)) * 100)}%` : '0%', icon: CheckCircle2, color: 'bg-orange-500' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-500">Ringkasan aktivitas broadcast Kemendagri Otda.</p>
        </div>
        <div className={cn(
          "px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2",
          watzapStatus?.status === 'success' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
        )}>
          <div className={cn("w-2 h-2 rounded-full animate-pulse", watzapStatus?.status === 'success' ? "bg-emerald-500" : "bg-red-500")} />
          Watzap Status: {watzapStatus?.status === 'success' ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4"
          >
            <div className={cn("p-3 rounded-xl text-white", stat.color)}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Broadcasts</h3>
          <div className="space-y-4">
            {broadcasts.slice(0, 5).map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    b.category.includes('Ulang Tahun') ? "bg-pink-100 text-pink-600" :
                    b.category.includes('HUT') ? "bg-blue-100 text-blue-600" :
                    b.category.includes('Agenda') ? "bg-orange-100 text-orange-600" : "bg-emerald-100 text-emerald-600"
                  )}>
                    {b.category.includes('Ulang Tahun') ? <Cake className="w-5 h-5" /> :
                     b.category.includes('HUT') ? <Flag className="w-5 h-5" /> :
                     b.category.includes('Agenda') ? <Calendar className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{b.title}</p>
                    <p className="text-xs text-gray-500">
                      {b.status === 'scheduled' && b.scheduledAt 
                        ? `Scheduled: ${format(b.scheduledAt.toDate(), 'dd MMM yyyy, HH:mm')}`
                        : format(b.createdAt?.toDate() || new Date(), 'dd MMM yyyy, HH:mm')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {b.status === 'scheduled' ? (
                    <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold uppercase">Scheduled</span>
                  ) : (
                    <>
                      <p className="text-xs font-bold text-gray-900">{b.successCount}/{b.recipientCount}</p>
                      <p className="text-[10px] text-gray-500 uppercase">Success</p>
                    </>
                  )}
                </div>
              </div>
            ))}
            {broadcasts.length === 0 && <p className="text-center text-gray-500 py-8">Belum ada broadcast.</p>}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recipient Distribution</h3>
          <div className="space-y-4">
            {['Kepala Daerah', 'Internal Kemendagri', 'Dirjen Otda'].map((cat) => {
              const count = recipients.filter(r => r.category === cat).length;
              const percentage = recipients.length > 0 ? (count / recipients.length) * 100 : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-gray-700">{cat}</span>
                    <span className="text-gray-500">{count} contacts</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// --- Confirmation Modal Component ---
const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Hapus", 
  cancelText = "Batal",
  type = 'danger'
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void, 
  title: string, 
  message: string, 
  confirmText?: string, 
  cancelText?: string,
  type?: 'danger' | 'warning' | 'info'
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
          >
            <div className="p-8">
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center mb-6",
                type === 'danger' ? "bg-red-50 text-red-600" : 
                type === 'warning' ? "bg-yellow-50 text-yellow-600" : "bg-blue-50 text-blue-600"
              )}>
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{title}</h3>
              <p className="text-gray-600 leading-relaxed">{message}</p>
            </div>
            <div className="p-6 bg-gray-50 flex gap-3">
              <button 
                onClick={onClose}
                className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                {cancelText}
              </button>
              <button 
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={cn(
                  "flex-1 px-6 py-3 rounded-xl font-bold text-white transition-colors",
                  type === 'danger' ? "bg-red-600 hover:bg-red-700" : 
                  type === 'warning' ? "bg-yellow-600 hover:bg-yellow-700" : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// --- Template Manager Component ---
const TemplateManager = ({ templates, user, addToast }: { templates: Template[], user: User, addToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', content: '', category: 'Umum' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean, id: string }>({ isOpen: false, id: '' });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'templates'), {
        ...newTemplate,
        authorUid: user.uid,
        createdAt: serverTimestamp()
      }).catch(err => handleFirestoreError(err, OperationType.CREATE, 'templates'));
      setNewTemplate({ name: '', content: '', category: 'Umum' });
      setIsAdding(false);
      addToast('Template berhasil disimpan!', 'success');
    } catch (error) {
      addToast('Gagal menyimpan template.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'templates', id)).catch(err => handleFirestoreError(err, OperationType.DELETE, `templates/${id}`));
      addToast('Template berhasil dihapus.', 'success');
    } catch (error) {
      addToast('Gagal menghapus template.', 'error');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Message Templates</h2>
          <p className="text-gray-500">Kelola template pesan permanen untuk broadcast.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Buat Template Baru
        </button>
      </div>

      <ConfirmationModal 
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, id: '' })}
        onConfirm={() => handleDelete(confirmDelete.id)}
        title="Hapus Template"
        message="Apakah Anda yakin ingin menghapus template ini? Tindakan ini tidak dapat dibatalkan."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((t) => (
          <motion.div 
            key={t.id}
            whileHover={{ y: -4 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 group relative flex flex-col"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
                <FileUp className="w-6 h-6" />
              </div>
              <button 
                onClick={() => setConfirmDelete({ isOpen: true, id: t.id })}
                className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">{t.name}</h3>
            <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full w-fit mb-4 uppercase tracking-wider">{t.category}</span>
            <p className="text-sm text-gray-500 mb-6 line-clamp-4 flex-1 whitespace-pre-wrap">{t.content}</p>
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              Dibuat: {format(t.createdAt?.toDate() || new Date(), 'dd MMM yyyy')}
            </div>
          </motion.div>
        ))}
        {templates.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-gray-200">
            <FileUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Belum ada template. Silakan buat template baru.</p>
          </div>
        )}
      </div>

      {/* Modal Tambah Template */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Buat Template Baru</h3>
                <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Template</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Contoh: Ucapan HUT Daerah"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kategori</label>
                  <select 
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newTemplate.category}
                    onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                  >
                    <option value="Umum">Umum</option>
                    <option value="Ulang Tahun">Ulang Tahun</option>
                    <option value="HUT Daerah">HUT Daerah</option>
                    <option value="Agenda">Agenda</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Isi Pesan</label>
                  <p className="text-[10px] text-gray-400 mb-2">Gunakan variabel: {"{{nama}}"}, {"{{wilayah}}"}, {"{{jabatan}}"}</p>
                  <textarea 
                    required
                    rows={8}
                    placeholder="Tulis isi pesan template di sini..."
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    value={newTemplate.content}
                    onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Memproses...' : 'Simpan Template'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const RecipientManager = ({ 
  recipients, 
  contactLists, 
  setRecipients, 
  setContactLists, 
  addToast 
}: { 
  recipients: Recipient[], 
  contactLists: ContactList[], 
  setRecipients: React.Dispatch<React.SetStateAction<Recipient[]>>, 
  setContactLists: React.Dispatch<React.SetStateAction<ContactList[]>>, 
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void 
}) => {
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [isAddingList, setIsAddingList] = useState(false);
  const [newList, setNewList] = useState({ name: '', description: '' });
  const [isAddingRecipient, setIsAddingRecipient] = useState(false);
  const [newRecipient, setNewRecipient] = useState({ name: '', phone: '', region: '', birthDate: '', regionAnniversaryDate: '' });
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDeleteList, setConfirmDeleteList] = useState<{ isOpen: boolean, id: string }>({ isOpen: false, id: '' });
  const [confirmDeleteRecipient, setConfirmDeleteRecipient] = useState<{ isOpen: boolean, id: string }>({ isOpen: false, id: '' });

  const selectedList = contactLists.find(l => l.id === selectedListId);
  
  const filteredRecipients = useMemo(() => {
    return recipients.filter(r => {
      const matchesList = r.listId === selectedListId;
      const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) || r.phone.includes(search);
      return matchesList && matchesSearch;
    });
  }, [recipients, selectedListId, search]);

    const handleAddList = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      try {
        await apiClient.post('/contact-lists', newList);
        setNewList({ name: '', description: '' });
        setIsAddingList(false);
        addToast('Daftar kontak berhasil dibuat!', 'success');
        // Refresh local data (simplistic, could be optimized)
        const updatedLists = await apiClient.get('/contact-lists');
        setContactLists(updatedLists);
      } catch (error) {
        addToast('Gagal membuat daftar kontak.', 'error');
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleDeleteList = async (id: string) => {
      if (!confirm('Hapus daftar kontak ini?')) return;
      try {
        await apiClient.delete(`/contact-lists/${id}`);
        if (selectedListId === id) setSelectedListId(null);
        addToast('Daftar kontak berhasil dihapus.', 'success');
        setContactLists(prev => prev.filter(l => l.id !== id));
      } catch (error) {
        addToast('Gagal menghapus daftar kontak.', 'error');
      }
    };

    const handleAddRecipient = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedListId) return;
      setIsSubmitting(true);
      try {
        await apiClient.post(`/contact-lists/${selectedListId}/recipients`, {
          ...newRecipient
        });
        setNewRecipient({ name: '', phone: '', region: '' });
        setIsAddingRecipient(false);
        addToast('Kontak berhasil ditambahkan!', 'success');
        const updatedRecipients = await apiClient.get(`/contact-lists/${selectedListId}/recipients`);
        setRecipients(prev => [...prev.filter(r => r.listId !== selectedListId), ...updatedRecipients]);
      } catch (error) {
        addToast('Gagal menambahkan kontak.', 'error');
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleDeleteRecipient = async (id: string) => {
      if (!confirm('Hapus kontak ini?')) return;
      try {
        await apiClient.delete(`/recipients/${id}`);
        addToast('Kontak berhasil dihapus.', 'success');
        setRecipients(prev => prev.filter(r => r.id !== id));
      } catch (error) {
        addToast('Gagal menghapus kontak.', 'error');
      }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !selectedListId) return;

      addToast('Sedang memproses file CSV...', 'info');

      Papa.parse(file, {
        header: true,
        complete: async (results) => {
          try {
            await apiClient.post(`/contact-lists/${selectedListId}/import`, {
              recipients: results.data.filter((r: any) => r.name && r.phone)
            });
            addToast(`Kontak berhasil diimport!`, 'success');
            const updatedRecipients = await apiClient.get(`/contact-lists/${selectedListId}/recipients`);
            setRecipients(prev => [...prev.filter(r => r.listId !== selectedListId), ...updatedRecipients]);
          } catch (error) {
            addToast('Gagal mengimport file CSV.', 'error');
          }
        }
      });
    };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Recipient Management</h2>
          <p className="text-gray-500">Kelola daftar kontak penerima broadcast.</p>
        </div>
        {!selectedListId && (
          <button 
            onClick={() => setIsAddingList(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Buat Daftar Baru
          </button>
        )}
      </div>

      <ConfirmationModal 
        isOpen={confirmDeleteList.isOpen}
        onClose={() => setConfirmDeleteList({ isOpen: false, id: '' })}
        onConfirm={() => handleDeleteList(confirmDeleteList.id)}
        title="Hapus Daftar Kontak"
        message="Apakah Anda yakin ingin menghapus daftar kontak ini? Kontak di dalamnya akan tetap ada di database tapi tidak terasosiasi dengan daftar ini."
      />

      <ConfirmationModal 
        isOpen={confirmDeleteRecipient.isOpen}
        onClose={() => setConfirmDeleteRecipient({ isOpen: false, id: '' })}
        onConfirm={() => handleDeleteRecipient(confirmDeleteRecipient.id)}
        title="Hapus Kontak"
        message="Apakah Anda yakin ingin menghapus kontak ini? Tindakan ini tidak dapat dibatalkan."
      />

      {!selectedListId ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contactLists.map((list) => (
            <motion.div 
              key={list.id}
              whileHover={{ y: -4 }}
              className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 group relative"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
                  <Users className="w-6 h-6" />
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteList({ isOpen: true, id: list.id }); }}
                  className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{list.name}</h3>
              <p className="text-sm text-gray-500 mb-4 line-clamp-2">{list.description || 'Tidak ada deskripsi.'}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {recipients.filter(r => r.listId === list.id).length} Kontak
                </span>
                <button 
                  onClick={() => setSelectedListId(list.id)}
                  className="text-sm font-bold text-blue-600 hover:underline"
                >
                  Lihat Kontak →
                </button>
              </div>
            </motion.div>
          ))}
          {contactLists.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-gray-200">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Belum ada daftar kontak. Silakan buat daftar baru.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedListId(null)}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <h3 className="text-xl font-bold text-gray-900">{selectedList?.name}</h3>
              <p className="text-sm text-gray-500">{selectedList?.description}</p>
            </div>
            <div className="ml-auto flex gap-2">
              <label className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer hover:bg-gray-50">
                <FileUp className="w-4 h-4" />
                Import CSV
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
              </label>
              <button 
                onClick={() => setIsAddingRecipient(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Tambah Kontak
              </button>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Cari berdasarkan nama atau nomor..." 
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-bottom border-gray-100">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Nama</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Nomor WA</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Wilayah</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Ultah/HUT</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <AnimatePresence mode="popLayout">
                  {filteredRecipients.map((r) => (
                    <motion.tr 
                      key={r.id} 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, x: -20 }}
                      layout
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{r.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{r.phone}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{r.region || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="flex flex-col gap-0.5">
                          {r.birthDate && <span className="flex items-center gap-1 text-[10px] text-pink-600 font-bold"><Cake className="w-2.5 h-2.5" /> {r.birthDate}</span>}
                          {r.regionAnniversaryDate && <span className="flex items-center gap-1 text-[10px] text-blue-600 font-bold"><Flag className="w-2.5 h-2.5" /> {r.regionAnniversaryDate}</span>}
                          {!r.birthDate && !r.regionAnniversaryDate && '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setConfirmDeleteRecipient({ isOpen: true, id: r.id })}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
            {filteredRecipients.length === 0 && (
              <div className="p-12 text-center text-gray-500">Belum ada kontak di daftar ini.</div>
            )}
          </div>
        </div>
      )}

      {/* Modal Tambah Daftar */}
      <AnimatePresence>
        {isAddingList && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6">Buat Daftar Kontak Baru</h3>
              <form onSubmit={handleAddList} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Daftar</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Contoh: Kepala Daerah"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newList.name}
                    onChange={(e) => setNewList({ ...newList, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Deskripsi</label>
                  <textarea 
                    placeholder="Deskripsi singkat..."
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newList.description}
                    onChange={(e) => setNewList({ ...newList, description: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddingList(false)}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Memproses...' : 'Simpan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Tambah Kontak */}
      <AnimatePresence>
        {isAddingRecipient && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6">Tambah Kontak Baru</h3>
              <form onSubmit={handleAddRecipient} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Lengkap</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Nama kontak..."
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newRecipient.name}
                    onChange={(e) => setNewRecipient({ ...newRecipient, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nomor WhatsApp</label>
                  <input 
                    required
                    type="tel" 
                    placeholder="628123456789"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newRecipient.phone}
                    onChange={(e) => setNewRecipient({ ...newRecipient, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Wilayah (Opsional)</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: Jawa Barat"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newRecipient.region}
                    onChange={(e) => setNewRecipient({ ...newRecipient, region: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ultah (MM-DD)</label>
                    <input 
                      type="text" 
                      placeholder="05-12"
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={newRecipient.birthDate}
                      onChange={(e) => setNewRecipient({ ...newRecipient, birthDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">HUT (MM-DD)</label>
                    <input 
                      type="text" 
                      placeholder="08-17"
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={newRecipient.regionAnniversaryDate}
                      onChange={(e) => setNewRecipient({ ...newRecipient, regionAnniversaryDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddingRecipient(false)}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Memproses...' : 'Simpan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const BroadcastList = ({ type, broadcasts, onCreateNew }: { type: 'birthday' | 'hut' | 'agenda' | 'internal', broadcasts: Broadcast[], onCreateNew: (template?: Broadcast) => void }) => {
  const typeConfig = {
    birthday: { label: 'Ulang Tahun Kepala Daerah', icon: Cake, color: 'text-pink-500', bg: 'bg-pink-50' },
    hut: { label: 'HUT Daerah', icon: Flag, color: 'text-blue-500', bg: 'bg-blue-50' },
    agenda: { label: 'Agenda Dirjen Otda', icon: Calendar, color: 'text-orange-500', bg: 'bg-orange-50' },
    internal: { label: 'Internal Kemendagri Otda', icon: Building2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  };

  const config = typeConfig[type];
  const filteredBroadcasts = broadcasts.filter(b => b.category === config.label);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className={cn("p-4 rounded-2xl", config.bg, config.color)}>
            <config.icon className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">{config.label}</h2>
            <p className="text-gray-500">Daftar broadcast dan template kategori ini.</p>
          </div>
        </div>
        <button 
          onClick={() => onCreateNew()}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
        >
          <Plus className="w-5 h-5" />
          Buat Broadcast Baru
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBroadcasts.length === 0 ? (
          <div className="col-span-full bg-white border border-dashed border-gray-200 rounded-3xl p-12 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <config.icon className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Belum ada broadcast</h3>
            <p className="text-gray-500 mb-6">Mulai kirim broadcast pertama Anda untuk kategori ini.</p>
            <button 
              onClick={() => onCreateNew()}
              className="text-blue-600 font-bold hover:underline"
            >
              Klik di sini untuk membuat
            </button>
          </div>
        ) : (
          filteredBroadcasts.map((b) => (
            <motion.div 
              key={b.id}
              whileHover={{ y: -5 }}
              className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-4">
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                  b.status === 'completed' ? "bg-emerald-100 text-emerald-700" :
                  b.status === 'scheduled' ? "bg-purple-100 text-purple-700" : 
                  b.status === 'draft' ? "bg-gray-100 text-gray-700" : "bg-blue-100 text-blue-700"
                )}>
                  {b.status}
                </span>
                <span className="text-[10px] text-gray-400 font-bold uppercase">{format(b.createdAt?.toDate() || new Date(), 'dd MMM yyyy')}</span>
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">{b.title}</h4>
              <p className="text-sm text-gray-500 mb-6 line-clamp-3 flex-1">{b.content}</p>
              <div className="flex items-center justify-between pt-4 border-t border-gray-50 mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-bold text-gray-700">{b.recipientCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-bold text-emerald-600">{b.successCount}</span>
                </div>
              </div>
              <button 
                onClick={() => onCreateNew(b)}
                className="w-full py-2 bg-gray-50 text-gray-600 text-xs font-bold rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <History className="w-3 h-3" />
                Gunakan Sebagai Template
              </button>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
};

const BroadcastForm = ({ type, recipients, contactLists, user, templates, onSuccess, onCancel, addToast, template }: { type: 'birthday' | 'hut' | 'agenda' | 'internal', recipients: Recipient[], contactLists: ContactList[], user: User, templates: Template[], onSuccess: () => void, onCancel: () => void, addToast: (msg: string, type?: 'success' | 'error' | 'info') => void, template?: Broadcast }) => {
  const [formData, setFormData] = useState({
    title: template?.title || '',
    content: template?.content || '',
    mediaUrl: template?.mediaUrl || '',
    targetListId: 'All'
  });
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentRecipient, setCurrentRecipient] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);

  const handleTemplateSelect = (templateId: string) => {
    const t = templates.find(temp => temp.id === templateId);
    if (t) {
      setFormData(prev => ({ ...prev, content: t.content }));
    }
  };

  useEffect(() => {
    if (mediaFile) {
      const url = URL.createObjectURL(mediaFile);
      setMediaPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setMediaPreview(null);
    }
  }, [mediaFile]);

  const typeConfig = {
    birthday: { label: 'Ulang Tahun Kepala Daerah', icon: Cake, color: 'text-pink-500', media: 'video', defaultTargetName: 'Kepala Daerah' },
    hut: { label: 'HUT Daerah', icon: Flag, color: 'text-blue-500', media: 'video', defaultTargetName: 'Kepala Daerah' },
    agenda: { label: 'Agenda Dirjen Otda', icon: Calendar, color: 'text-orange-500', media: 'image', defaultTargetName: 'Dirjen Otda' },
    internal: { label: 'Internal Kemendagri Otda', icon: Building2, color: 'text-emerald-500', media: 'image', defaultTargetName: 'Internal Kemendagri' },
  };

  const config = typeConfig[type];

  const filteredRecipients = useMemo(() => {
    return recipients.filter(r => {
      const matchCategory = formData.targetListId === 'All' || r.listId === formData.targetListId;
      const matchSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.phone.includes(searchTerm);
      return matchCategory && matchSearch;
    });
  }, [recipients, formData.targetListId, searchTerm]);

  useEffect(() => {
    const defaultList = contactLists.find(l => l.name.toLowerCase().includes(config.defaultTargetName.toLowerCase()));
    if (defaultList) {
      setFormData(prev => ({ ...prev, targetListId: defaultList.id }));
    } else {
      setFormData(prev => ({ ...prev, targetListId: 'All' }));
    }
  }, [type, config.defaultTargetName, contactLists]);

  useEffect(() => {
    // Auto select all in list when list changes
    const ids = recipients
      .filter(r => formData.targetListId === 'All' || r.listId === formData.targetListId)
      .map(r => r.id);
    setSelectedIds(ids);
  }, [formData.targetListId, recipients]);

  const toggleRecipient = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === filteredRecipients.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRecipients.map(r => r.id));
    }
  };

  const handleSend = async (e: React.FormEvent, isDraft: boolean = false) => {
    if (e) e.preventDefault();
    
    if (!formData.title || !formData.content) {
      addToast('Judul dan isi pesan wajib diisi.', 'error');
      return;
    }

    if (selectedIds.length === 0 && !isDraft) {
      addToast('Pilih minimal satu kontak untuk mengirim broadcast.', 'error');
      return;
    }

    setSending(true);
    
    try {
      let finalMediaUrl = formData.mediaUrl;

      // 1. Upload file to Firebase Storage if selected (optional, can be moved to Laravel)
      if (mediaFile) {
        setIsUploading(true);
        const storageRef = ref(storage, `broadcasts/${Date.now()}_${mediaFile.name}`);
        const uploadTask = uploadBytesResumable(storageRef, mediaFile);

        finalMediaUrl = await new Promise((resolve, reject) => {
          uploadTask.on('state_changed', 
            (snapshot) => {
              const p = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              setUploadProgress(p);
            }, 
            (error) => reject(error), 
            async () => {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadUrl);
            }
          );
        });
        setIsUploading(false);
      }

      // 2. Delegate to Laravel API
      await apiClient.post('/broadcasts', {
        title: formData.title,
        content: formData.content,
        category: config.label,
        target_list_id: formData.targetListId,
        recipient_ids: selectedIds,
        media_url: finalMediaUrl || null,
        media_type: config.media === 'video' ? 'video' : 'image',
        scheduled_at: scheduledDate || null,
        author_uid: user.uid,
        is_draft: isDraft
      });

      addToast(isDraft ? 'Draft disimpan!' : 'Broadcast telah masuk antrean!', 'success');
      onSuccess();

      // Refresh history data
      const updatedBroadcasts = await apiClient.get('/broadcasts');
      setBroadcasts(updatedBroadcasts);

    } catch (error) {
      console.error("Broadcast failed:", error);
      addToast('Gagal memproses broadcast.', 'error');
    } finally {
      setSending(false);
      setUploadProgress(0);
      setIsUploading(false);
    }
  };


  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8"
    >
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 mb-8">
          <div className={cn("p-4 rounded-2xl bg-gray-50", config.color)}>
            <config.icon className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{config.label}</h2>
            <p className="text-gray-500">Kirim pesan broadcast baru.</p>
          </div>
        </div>

        <form onSubmit={handleSend} className="space-y-6">
          <div className="flex justify-end">
            <button 
              type="button"
              onClick={onCancel}
              className="text-xs font-bold text-gray-400 hover:text-gray-600 uppercase tracking-widest"
            >
              Batal & Kembali ke Daftar
            </button>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Judul Broadcast</label>
            <input 
              required
              type="text" 
              placeholder="Contoh: Ucapan Selamat Ulang Tahun Gubernur..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pilih Daftar Kontak</label>
            <select 
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={formData.targetListId}
              onChange={(e) => setFormData({...formData, targetListId: e.target.value})}
            >
              <option value="All">Semua Kontak</option>
              {contactLists.map(list => (
                <option key={list.id} value={list.id}>{list.name}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-gray-500 uppercase">Pilih Kontak ({selectedIds.length})</label>
              <button 
                type="button"
                onClick={toggleAll}
                className="text-[10px] font-bold text-blue-600 uppercase hover:underline"
              >
                {selectedIds.length === filteredRecipients.length ? 'Hapus Semua' : 'Pilih Semua'}
              </button>
            </div>
            
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text"
                placeholder="Cari nama atau nomor..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="border border-gray-100 rounded-xl overflow-hidden bg-gray-50 max-h-[200px] overflow-y-auto">
              {filteredRecipients.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs italic">
                  Tidak ada kontak ditemukan.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredRecipients.map((r) => (
                    <label 
                      key={r.id}
                      className="flex items-center gap-3 p-3 hover:bg-white cursor-pointer transition-colors"
                    >
                      <input 
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedIds.includes(r.id)}
                        onChange={() => toggleRecipient(r.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{r.name}</p>
                        <p className="text-[10px] text-gray-500">{r.phone} • {r.category}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Jadwalkan Pengiriman (Opsional)</label>
            <input 
              type="datetime-local" 
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
            <p className="text-[10px] text-gray-400 mt-1 italic">* Kosongkan jika ingin mengirim sekarang juga.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Isi Pesan (Teks)</label>
            <div className="mb-2">
              <select 
                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                onChange={(e) => handleTemplateSelect(e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>Pilih dari Template...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <textarea 
              required
              rows={5}
              placeholder="Tulis pesan Anda di sini..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={formData.content}
              onChange={(e) => setFormData({...formData, content: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Media {config.media === 'video' ? 'Video' : 'Gambar'}</label>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-6 hover:bg-gray-50 cursor-pointer transition-all">
                  <FileUp className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-600">
                    {mediaFile ? mediaFile.name : `Pilih file ${config.media}`}
                  </span>
                  <input 
                    type="file" 
                    accept={config.media === 'video' ? 'video/*' : 'image/*'} 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setMediaFile(file);
                    }} 
                  />
                </label>
                {mediaFile && (
                  <button 
                    type="button"
                    onClick={() => setMediaFile(null)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-100" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-400 font-bold">Atau gunakan URL</span>
                </div>
              </div>

              <input 
                type="url" 
                placeholder="https://example.com/media.mp4"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={formData.mediaUrl}
                onChange={(e) => setFormData({...formData, mediaUrl: e.target.value})}
                disabled={!!mediaFile}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1 italic">Pastikan file atau URL dapat diakses publik.</p>
          </div>

          <div className="pt-4">
            {isUploading ? (
              <div className="space-y-4">
                <div className="flex justify-between text-sm font-bold">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Mengupload media...
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    className="h-full bg-blue-600" 
                  />
                </div>
              </div>
            ) : sending ? (
              <div className="space-y-4">
                <div className="flex justify-between text-sm font-bold">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Mengirim ke {currentRecipient}...
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-blue-600" 
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={(e) => handleSend(e as any, false)}
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
                >
                  <Send className="w-5 h-5" />
                  {scheduledDate ? 'Simpan & Jadwalkan Broadcast' : 'Kirim Broadcast Sekarang'}
                </motion.button>

                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={(e) => handleSend(e as any, true)}
                  className="w-full bg-white text-gray-700 border border-gray-200 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-all"
                >
                  <History className="w-5 h-5 text-gray-400" />
                  Simpan sebagai Draft
                </motion.button>
              </div>
            )}
          </div>
        </form>
      </div>

      <div className="space-y-6 sticky top-8">
        <div className="bg-gray-900 rounded-3xl p-6 shadow-2xl relative overflow-hidden min-h-[500px] flex flex-col border border-gray-800">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/50" />
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                <Send className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">WhatsApp Preview</span>
            </div>
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-gray-700" />
              <div className="w-2 h-2 rounded-full bg-gray-700" />
              <div className="w-2 h-2 rounded-full bg-gray-700" />
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-4 bg-[#efeae2] p-4 rounded-2xl relative overflow-hidden">
            {/* WhatsApp Chat Bubble */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              className="bg-[#dcf8c6] rounded-lg rounded-tr-none self-end max-w-[90%] shadow-sm relative z-10 overflow-hidden"
            >
              {/* Media Preview */}
              {(formData.mediaUrl || mediaPreview) && (
                <div className="w-full bg-black/5 relative group">
                  {config.media === 'video' ? (
                    <video 
                      src={mediaPreview || formData.mediaUrl} 
                      className="w-full aspect-video object-cover"
                      controls={false}
                      autoPlay
                      muted
                      loop
                    />
                  ) : (
                    <img 
                      src={mediaPreview || formData.mediaUrl} 
                      alt="Preview" 
                      className="w-full object-cover max-h-[300px]"
                      onError={(e) => (e.currentTarget.src = 'https://picsum.photos/seed/error/800/450')}
                    />
                  )}
                </div>
              )}
              
              {/* Text Content */}
              <div className="px-3 py-2 pb-5 min-w-[150px] relative">
                <p className="text-[14px] text-gray-800 whitespace-pre-wrap leading-tight mb-1">
                  {formData.content || 'Isi pesan akan muncul di sini...'}
                </p>
                <div className="absolute bottom-1 right-2 flex items-center gap-1">
                  <span className="text-[10px] text-gray-500 uppercase">{format(new Date(), 'HH:mm')}</span>
                  <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                </div>
              </div>
              
              {/* Bubble Tail */}
              <div 
                className="absolute top-0 -right-2 w-2 h-3 bg-[#dcf8c6]" 
                style={{ clipPath: 'polygon(0 0, 0% 100%, 100% 0)' }} 
              />
            </motion.div>

            {/* Background Pattern (WhatsApp style) */}
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: '400px' }} />
          </div>

          <div className="mt-auto pt-6 border-t border-gray-800 flex items-center gap-3">
            <div className="flex-1 h-10 bg-gray-800 rounded-full border border-gray-700 px-4 flex items-center text-gray-500 text-xs">
              Type a message...
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
              <Send className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
          <h4 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Tips Broadcast
          </h4>
          <ul className="text-xs text-blue-700 space-y-2 list-disc pl-4">
            <li>Gunakan URL media yang valid dan dapat diakses publik.</li>
            <li>Pastikan nomor telepon recipient menggunakan format internasional (contoh: 628...).</li>
            <li>Hindari mengirim terlalu banyak pesan dalam waktu singkat untuk mencegah blokir.</li>
          </ul>
        </div>
      </div>
    </motion.div>
  );
};

const BroadcastHistory = ({ broadcasts }: { broadcasts: Broadcast[] }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Broadcast History</h2>
        <p className="text-gray-500">Riwayat pengiriman pesan WhatsApp.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {broadcasts.map((b) => (
          <div key={b.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className={cn(
                "p-3 rounded-xl",
                b.category.includes('Ulang Tahun') ? "bg-pink-100 text-pink-600" :
                b.category.includes('HUT') ? "bg-blue-100 text-blue-600" :
                b.category.includes('Agenda') ? "bg-orange-100 text-orange-600" : "bg-emerald-100 text-emerald-600"
              )}>
                {b.category.includes('Ulang Tahun') ? <Cake className="w-6 h-6" /> :
                 b.category.includes('HUT') ? <Flag className="w-6 h-6" /> :
                 b.category.includes('Agenda') ? <Calendar className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
              </div>
              <div>
                <h4 className="font-bold text-gray-900">{b.title}</h4>
                <p className="text-xs text-gray-500 mb-2">
                  {b.status === 'scheduled' && b.scheduledAt 
                    ? `Jadwal: ${format(b.scheduledAt.toDate(), 'dd MMMM yyyy, HH:mm')}`
                    : format(b.createdAt?.toDate() || new Date(), 'dd MMMM yyyy, HH:mm')}
                </p>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                    b.status === 'completed' ? "bg-emerald-100 text-emerald-700" :
                    b.status === 'sending' ? "bg-blue-100 text-blue-700" : 
                    b.status === 'scheduled' ? "bg-purple-100 text-purple-700" : 
                    b.status === 'draft' ? "bg-gray-100 text-gray-700" : "bg-red-100 text-red-700"
                  )}>
                    {b.status}
                  </span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">{b.mediaType}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-8 items-center">
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">{b.recipientCount}</p>
                <p className="text-[10px] text-gray-500 uppercase font-bold">Total</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-600">{b.successCount}</p>
                <p className="text-[10px] text-emerald-500 uppercase font-bold">Success</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-red-600">{b.failedCount}</p>
                <p className="text-[10px] text-red-500 uppercase font-bold">Failed</p>
              </div>
            </div>
          </div>
        ))}
        {broadcasts.length === 0 && (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-gray-200 text-center text-gray-500">
            Belum ada riwayat broadcast.
          </div>
        )}
      </div>
    </motion.div>
  );
};

const UserManager = ({ addToast }: { addToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmRole, setConfirmRole] = useState<{ isOpen: boolean, id: string, currentRole: string }>({ isOpen: false, id: '', currentRole: '' });
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean, id: string }>({ isOpen: false, id: '' });
  
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  
  const [managingPermissions, setManagingPermissions] = useState<{ isOpen: boolean, user: any | null }>({ isOpen: false, user: null });

  const MODULES = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'recipients', label: 'Recipients' },
    { id: 'templates', label: 'Templates' },
    { id: 'history', label: 'History' },
    { id: 'birthday', label: 'Ulang Tahun' },
    { id: 'hut', label: 'HUT Daerah' },
    { id: 'agenda', label: 'Agenda Dirjen' },
    { id: 'internal', label: 'Internal Otda' },
  ];

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });
    return () => unsub();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail) return;
    
    try {
      // Check if user already exists
      const q = query(collection(db, 'users'), where('email', '==', newUserEmail));
      const snap = await getDocs(q).catch(err => handleFirestoreError(err, OperationType.LIST, 'users'));
      
      if (snap && !snap.empty) {
        addToast('User dengan email ini sudah terdaftar.', 'error');
        return;
      }

      const defaultPermissions = MODULES.reduce((acc, mod) => ({ ...acc, [mod.id]: true }), {});

      await addDoc(collection(db, 'users'), {
        email: newUserEmail,
        role: newUserRole,
        permissions: defaultPermissions,
        createdAt: serverTimestamp(),
        displayName: 'Pending User'
      }).catch(err => handleFirestoreError(err, OperationType.CREATE, 'users'));

      setNewUserEmail('');
      setIsAddingUser(false);
      addToast('User berhasil ditambahkan!', 'success');
    } catch (error) {
      addToast('Gagal menambahkan user.', 'error');
    }
  };

  const togglePermission = async (userId: string, moduleId: string, currentStatus: boolean) => {
    try {
      const user = users.find(u => u.id === userId);
      const newPermissions = { 
        ...(user.permissions || {}), 
        [moduleId]: !currentStatus 
      };
      
      await updateDoc(doc(db, 'users', userId), { 
        permissions: newPermissions 
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`));
      
      // Update local state for the modal if it's open
      if (managingPermissions.user?.id === userId) {
        setManagingPermissions(prev => ({
          ...prev,
          user: { ...prev.user, permissions: newPermissions }
        }));
      }
    } catch (error) {
      addToast('Gagal memperbarui hak akses.', 'error');
    }
  };

  const toggleRole = async (userId: string, currentRole: string) => {
    try {
      const newRole = currentRole === 'admin' ? 'user' : 'admin';
      await updateDoc(doc(db, 'users', userId), { role: newRole }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`));
      addToast(`Role user berhasil diubah menjadi ${newRole}.`, 'success');
    } catch (error) {
      addToast('Gagal mengubah role user.', 'error');
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId)).catch(err => handleFirestoreError(err, OperationType.DELETE, `users/${userId}`));
      addToast('User berhasil dihapus.', 'success');
    } catch (error) {
      addToast('Gagal menghapus user.', 'error');
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="text-gray-500">Kelola hak akses dan peran pengguna dashboard.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Cari nama atau email..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsAddingUser(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Tambah User
          </button>
        </div>
      </div>

      <ConfirmationModal 
        isOpen={confirmRole.isOpen}
        onClose={() => setConfirmRole({ isOpen: false, id: '', currentRole: '' })}
        onConfirm={() => toggleRole(confirmRole.id, confirmRole.currentRole)}
        title="Ubah Role User"
        message={`Apakah Anda yakin ingin mengubah role user ini menjadi ${confirmRole.currentRole === 'admin' ? 'User' : 'Admin'}?`}
        type="warning"
        confirmText="Ubah"
      />

      <ConfirmationModal 
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, id: '' })}
        onConfirm={() => deleteUser(confirmDelete.id)}
        title="Hapus User"
        message="Apakah Anda yakin ingin menghapus user ini dari dashboard? User ini tidak akan bisa mengakses fitur admin lagi."
      />

      {/* Add User Modal */}
      <AnimatePresence>
        {isAddingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">Tambah User Baru</h3>
                <button onClick={() => setIsAddingUser(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <form onSubmit={handleAddUser} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Email Address</label>
                  <input 
                    type="email" 
                    required
                    placeholder="user@example.com"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Role</label>
                  <select 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsAddingUser(false)}
                    className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                  >
                    Tambah User
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manage Permissions Modal */}
      <AnimatePresence>
        {managingPermissions.isOpen && managingPermissions.user && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Kelola Hak Akses</h3>
                  <p className="text-xs text-gray-500">{managingPermissions.user.email}</p>
                </div>
                <button onClick={() => setManagingPermissions({ isOpen: false, user: null })} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {MODULES.map((mod) => {
                    const hasAccess = managingPermissions.user.permissions?.[mod.id] ?? true;
                    return (
                      <div 
                        key={mod.id}
                        onClick={() => togglePermission(managingPermissions.user.id, mod.id, hasAccess)}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all",
                          hasAccess ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-100 opacity-60"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            hasAccess ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"
                          )}>
                            {hasAccess ? <CheckCheck className="w-4 h-4" /> : <X className="w-4 h-4" />}
                          </div>
                          <span className={cn("text-sm font-bold", hasAccess ? "text-blue-900" : "text-gray-500")}>
                            {mod.label}
                          </span>
                        </div>
                        <div className={cn(
                          "w-10 h-5 rounded-full relative transition-colors",
                          hasAccess ? "bg-blue-600" : "bg-gray-300"
                        )}>
                          <div className={cn(
                            "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                            hasAccess ? "right-1" : "left-1"
                          )} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-8">
                  <button 
                    onClick={() => setManagingPermissions({ isOpen: false, user: null })}
                    className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors"
                  >
                    Selesai
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">User</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Role</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Modules</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Joined</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Memuat data pengguna...</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">
                    Tidak ada pengguna ditemukan.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm">
                          {u.displayName?.charAt(0) || u.email?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{u.displayName || 'No Name'}</p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        u.role === 'admin' 
                          ? "bg-purple-100 text-purple-700 border border-purple-200" 
                          : "bg-blue-100 text-blue-700 border border-blue-200"
                      )}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <button 
                          onClick={() => setManagingPermissions({ isOpen: true, user: u })}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-[10px] font-bold uppercase hover:bg-blue-50 hover:text-blue-600 transition-colors border border-gray-100"
                        >
                          <CheckCheck className="w-3 h-3" />
                          {Object.values(u.permissions || {}).filter(v => v).length} / {MODULES.length}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-gray-500">
                        {u.createdAt ? format(u.createdAt.toDate(), 'dd MMM yyyy') : '-'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {u.email !== "sigittekno565@gmail.com" && (
                          <>
                            <button 
                              onClick={() => setConfirmRole({ isOpen: true, id: u.id, currentRole: u.role })}
                              title={`Ubah ke ${u.role === 'admin' ? 'User' : 'Admin'}`}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            >
                              <Filter className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setConfirmDelete({ isOpen: true, id: u.id })}
                              title="Hapus User"
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {u.email === "sigittekno565@gmail.com" && (
                          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Super Admin</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

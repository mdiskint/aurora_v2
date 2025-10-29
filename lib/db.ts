import Dexie, { Table } from 'dexie';

interface UniverseRecord {
  id: string;
  data: any; // The full universe object
  timestamp: number;
}

interface BackupRecord {
  id: string;
  snapshot: any; // Full state snapshot
  timestamp: number;
  label: string;
}

class AuroraDatabase extends Dexie {
  universes!: Table<UniverseRecord>;
  backups!: Table<BackupRecord>;

  constructor() {
    super('AuroraDB');

    this.version(1).stores({
      universes: 'id, timestamp',
      backups: 'id, timestamp'
    });
  }
}

export const db = new AuroraDatabase();

// Save universe to IndexedDB
export async function saveUniverse(id: string, data: any) {
  try {
    await db.universes.put({
      id,
      data,
      timestamp: Date.now()
    });
    console.log('✅ Universe saved to IndexedDB:', id);
    return true;
  } catch (error) {
    console.error('❌ IndexedDB save failed:', error);
    return false;
  }
}

// Load universe from IndexedDB
export async function loadUniverse(id: string) {
  try {
    const record = await db.universes.get(id);
    return record?.data || null;
  } catch (error) {
    console.error('❌ IndexedDB load failed:', error);
    return null;
  }
}

// Load all universes
export async function loadAllUniverses() {
  try {
    const records = await db.universes.toArray();
    const universes: any = {};
    records.forEach(record => {
      universes[record.id] = record.data;
    });
    console.log('✅ Loaded', Object.keys(universes).length, 'universes from IndexedDB');
    return universes;
  } catch (error) {
    console.error('❌ IndexedDB load all failed:', error);
    return {};
  }
}

// Delete universe
export async function deleteUniverseFromDB(id: string) {
  try {
    await db.universes.delete(id);
    console.log('✅ Universe deleted from IndexedDB:', id);
    return true;
  } catch (error) {
    console.error('❌ IndexedDB delete failed:', error);
    return false;
  }
}

// Create backup snapshot
export async function createBackup(state: any, label: string = 'auto') {
  try {
    const backupId = `backup-${Date.now()}`;
    await db.backups.put({
      id: backupId,
      snapshot: state,
      timestamp: Date.now(),
      label
    });

    // Keep only last 10 backups
    const allBackups = await db.backups.orderBy('timestamp').toArray();
    if (allBackups.length > 10) {
      const toDelete = allBackups.slice(0, allBackups.length - 10);
      await Promise.all(toDelete.map(b => db.backups.delete(b.id)));
    }

    console.log('✅ Backup created:', backupId);
    return true;
  } catch (error) {
    console.error('❌ Backup failed:', error);
    return false;
  }
}

// List available backups
export async function listBackups() {
  try {
    const backups = await db.backups.orderBy('timestamp').reverse().toArray();
    return backups.map(b => ({
      id: b.id,
      timestamp: b.timestamp,
      label: b.label,
      date: new Date(b.timestamp).toLocaleString()
    }));
  } catch (error) {
    console.error('❌ List backups failed:', error);
    return [];
  }
}

// Restore from backup
export async function restoreBackup(backupId: string) {
  try {
    const backup = await db.backups.get(backupId);
    if (!backup) {
      console.error('Backup not found:', backupId);
      return null;
    }
    console.log('✅ Backup restored:', backupId);
    return backup.snapshot;
  } catch (error) {
    console.error('❌ Restore failed:', error);
    return null;
  }
}

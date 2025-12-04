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

interface VideoFileRecord {
  id: string; // universeId
  videoBlob: Blob;
  mimeType: string;
  timestamp: number;
}

class AuroraDatabase extends Dexie {
  universes!: Table<UniverseRecord>;
  backups!: Table<BackupRecord>;
  videos!: Table<VideoFileRecord>;

  constructor() {
    super('AuroraDB');

    this.version(2).stores({
      universes: 'id, timestamp',
      backups: 'id, timestamp',
      videos: 'id, timestamp'
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

// Save video file to IndexedDB
export async function saveVideoFile(universeId: string, videoFile: File) {
  try {
    await db.videos.put({
      id: universeId,
      videoBlob: videoFile,
      mimeType: videoFile.type,
      timestamp: Date.now()
    });
    console.log('✅ Video file saved to IndexedDB:', universeId);
    return true;
  } catch (error) {
    console.error('❌ Video file save failed:', error);
    return false;
  }
}

// Load video file from IndexedDB
export async function loadVideoFile(universeId: string): Promise<string | null> {
  try {
    const record = await db.videos.get(universeId);
    if (!record) return null;

    // Convert Blob to Object URL for video playback
    const url = URL.createObjectURL(record.videoBlob);
    console.log('✅ Video file loaded from IndexedDB:', universeId);
    return url;
  } catch (error) {
    console.error('❌ Video file load failed:', error);
    return null;
  }
}

// Delete video file
export async function deleteVideoFile(universeId: string) {
  try {
    await db.videos.delete(universeId);
    console.log('✅ Video file deleted from IndexedDB:', universeId);
    return true;
  } catch (error) {
    console.error('❌ Video file delete failed:', error);
    return false;
  }
}

// Save universe to Cloud (NeonDB)
export async function saveToCloud(id: string, data: any, videoUrl?: string) {
  try {
    const response = await fetch('/api/universes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id, data, videoUrl }),
    });

    if (response.ok) {
      console.log('✅ Universe saved to Cloud:', id);
      return true;
    } else {
      // If 401, user is not logged in, which is fine.
      if (response.status !== 401) {
        console.warn('⚠️ Cloud save failed:', response.statusText);
      }
      return false;
    }
  } catch (error) {
    console.error('❌ Cloud save error:', error);
    return false;
  }
}

// Load all universes from Cloud
export async function loadFromCloud() {
  try {
    const response = await fetch('/api/universes');
    if (response.ok) {
      const universes = await response.json();
      console.log('✅ Loaded universes from Cloud');
      // Convert array to object map to match loadAllUniverses format
      const universeMap: any = {};
      universes.forEach((u: any) => {
        universeMap[u.id] = u.data;
      });
      return universeMap;
    }
    return null;
  } catch (error) {
    console.error('❌ Cloud load error:', error);
    return null;
  }
}

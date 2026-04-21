import axios from 'axios'
import { repoSchema, snapshotSchema, type Repo, type Snapshot } from './schema'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api'

export async function getRepos(): Promise<Repo[]> {
    try {    
        const { data } = await axios.get(`${API_URL}/repos`)
        return repoSchema.array().parse(data)
    } catch (error) {
        console.error("Error fetching repos:", error);
        return [];
    }
}

export async function getSnapshots(repoId: string): Promise<Snapshot[]> {
    try {
        const { data } = await axios.get(`${API_URL}/repos/${repoId}/snapshots`)
        return snapshotSchema.array().parse(data)
    } catch (error) {
        console.error("Error fetching snapshots:", error);
        return [];
    }
}

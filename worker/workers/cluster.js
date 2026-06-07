import prisma from "../../api/lib/prisma.js";
import OpenAI from "openai";
import { kmeans } from "ml-kmeans";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MIN_FILES    = 20;
const K            = 4;
const SAMPLE_FILES = 5;
export const processCluster=async(job)=>{
    const {repoId, snapshotId, commitSha}=job.data;

   const rows = await prisma.$queryRaw`
          SELECT id, "filePath", embedding::text AS embedding_text
          FROM "FileAnalysis"
          WHERE "repoId" = ${repoId}
            AND embedding IS NOT NULL
      `;

    if(rows.length<MIN_FILES){
        console.log(`Not enough files with embeddings for repo ${repoId}. Skipping clustering.`);
        return{skipped:true};
    }

    const vectors = rows.map(row => JSON.parse(row.embedding_text));
    const fileIds = rows.map(row => row.id);
    const filePaths = rows.map(row => row.filePath);

    console.log(`[Cluster] Running k-means k=${K} on ${vectors.length} files`);

    const kmResult = kmeans(vectors, K, {
        initialization: 'kmeans++',
        maxIterations: 100,
    });

    // ml-kmeans can return centroids as objects or arrays depending on version
    const assignments = kmResult.clusters || kmResult.assignments || [];
    const centroids = kmResult.centroids || kmResult.centroid || [];

    await prisma.cluster.deleteMany({
        where: {
            repoId: repoId,
        },
    });

  for (let i = 0; i < K; i++) {
          const memberIndices = assignments
              .map((c, idx) => (c === i ? idx : -1))
              .filter(idx => idx !== -1);

          if (memberIndices.length === 0) continue;
  
          let centroid = centroids[i];
          if (centroid && centroid.centroid) centroid = centroid.centroid;

          const samplePaths = memberIndices
              .map(idx => ({ idx, dist: euclidean(vectors[idx], centroid) }))
              .sort((a, b) => a.dist - b.dist)
              .slice(0, SAMPLE_FILES)
              .map(x => filePaths[x.idx]);
  
          const { label, summary } = await labelCluster(samplePaths);
  
          const cluster = await prisma.cluster.create({
              data: { repoId, snapshotId, label, summary, fileCount: memberIndices.length },
          });

          await prisma.$executeRaw`
              UPDATE "Cluster"
              SET centroid = ${JSON.stringify(centroid)}::vector
              WHERE id = ${cluster.id}
          `;

          const memberFileIds = memberIndices.map(idx => fileIds[idx]);
          await prisma.fileAnalysis.updateMany({
              where: { id: { in: memberFileIds } },
              data:  { clusterId: cluster.id },
          });

          console.log(`[cluster] Created cluster "${label}" — ${memberIndices.length} files`);
      }

      await prisma.repo.update({
          where: { id: repoId },
          data:  { lastClusteredCommit: commitSha },
      });

      return { clustersCreated: K };
  };
  function euclidean(a, b) {
      let sum = 0;
      for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
      return Math.sqrt(sum);
  }

  async function labelCluster(samplePaths) {
      try { 
          const resp = await openai.chat.completions.create({
              model: process.env.OPENAI_INSIGHTS_MODEL || 'gpt-4o-mini',
              messages: [
                  {   
                      role: 'system',
                      content: 'Given file paths from one codebase cluster, respond with JSON: {"label": "2-4 word name", "summary": "one sentence describing what this cluster does"}',
                  },
                  {   
                      role: 'user',
                      content: samplePaths.join('\n'),
                  },
              ],
              response_format: { type: 'json_object' },
              max_tokens: 100,
          });
          return JSON.parse(resp.choices[0].message.content);
      } catch (err) {
          console.error('[cluster] GPT label error:', err.message);
          return { label: 'Unlabeled', summary: 'Could not generate label.' };
      }
  }
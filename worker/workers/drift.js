import { getFileContent } from "../../api/services/octokit.js";
import prisma from "../../api/lib/prisma.js";
import { storeWorkerResult } from "../resultStore.js";
import {embedText} from "../../api/services/embed.js";
import { Queue } from "bullmq";
export const processDrift=async(job)=>{
    const {repoId,owner,repoName,installationId,commitSha,ref,changedFiles}=job.data;
        const driftThreshold=0.72;
        const JS_TS=/\.(js|jsx|ts|tsx)$/;   
        const js_Files=changedFiles.filter(p=>JS_TS.test(p));   
        const results=[];
        let flaggedFiles=0;
        for(const filePath of js_Files){
            try{
                const content=await getFileContent(installationId,owner,repoName,filePath,ref);
                if(!content) continue;
                const embedding=await embedText(content);
                const similar = await prisma.$queryRaw`                                                                                                                                               
                    SELECT "filePath", 1 - (embedding <=> ${JSON.stringify(embedding)}::vector) AS similarity
                    FROM "FileAnalysis"
                    WHERE "repoId" = ${repoId}                                                                                                                                                          
                    AND "filePath" != ${filePath}
                    AND embedding IS NOT NULL                                                                                                                                                         
                    ORDER BY similarity DESC                                
                    LIMIT 5
                    `;

                 const maxSimilarity = similar.length > 0                                                                                                                                              
                 ? Math.max(...similar.map(r => Number(r.similarity)))   
                 : 1.0;                                                                                                                                                                              
   
                 const isDrift = maxSimilarity < driftThreshold;                                                                                                                                       
                                                            
                 if (isDrift) {                                                                                                                                                                        
                    flaggedFiles++;
                    console.log(`[drift] ${filePath} flagged — max similarity: ${maxSimilarity.toFixed(3)}`);                                                                                           
                 }         
                 const record = await prisma.fileAnalysis.upsert({                                                                                                                                     
                    where: { repoId_filePath: { repoId, filePath } },                                                                                                                                   
                    update: { driftScore: maxSimilarity },
                    create: { repoId, filePath, driftScore: maxSimilarity, snapshotId: null, isDead: false, complexity: 0 },                                                                            
                 });                                                                                                                                                                                   
                                                                                                                                                                                        
                 await prisma.$executeRaw`                                                                                                                                                             
                    UPDATE "FileAnalysis"                                   
                    SET embedding = ${JSON.stringify(embedding)}::vector                                                                                                                                
                    WHERE id = ${record.id}                                 
                 `;                                                                                                                                                                                    
   
                 results.push({ filePath, driftScore: maxSimilarity, isDrift });             
            }
            catch(err){
                console.error(`[drift] Error processing ${filePath}:`, err.message);
            }
        }
         const driftRatio = js_Files.length > 0 ? flaggedFiles / js_Files.length : 0;                                                                                                          
                                                                                                                                                                                        
        const finalReport = {
            worker: 'drift',                                                                                                                                                                    
            repoId,                                                 
            commitSha,
            flaggedFiles,
            totalFiles: js_Files.length,
            driftRatio,                                                                                                                                                                         
        };
                                                                                                                                                                                        
        const { complete, results: allResults } = await storeWorkerResult(repoId, commitSha, 'drift', finalReport);                                                                           
   
        if (complete) {                                                                                                                                                                                     
            const aggregatorQueue = new Queue('aggregator-queue', { connection: { url: process.env.REDIS_URL } });                                                                              
            await aggregatorQueue.add('aggregate', { repoId, commitSha, owner, repoName, results: allResults });                                                                                
            console.log(`[drift] All workers done — triggering aggregator for ${commitSha.slice(0, 8)}`);                                                                                       
        }                                                                                                                                                                                     
                                                            
        return finalReport;  
}
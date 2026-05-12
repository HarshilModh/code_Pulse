import prisma from "../lib/prisma.js";
import { embedText } from "./embed.js";

export async function retrieveContext(repoId,query, { topK = 5 } = {}) {
    const queryEmbedding = await embedText(query);       
    const results = await prisma.$queryRaw`
        SELECT "filePath", 1 - ("embedding" <=>  ${JSON.stringify(queryEmbedding)}::vector) AS similarity
        FROM "FileAnalysis"
        WHERE embedding IS NOT NULL AND "repoId" = ${repoId}
        ORDER BY similarity DESC
        LIMIT ${topK}`;                                                                     
   
    return results.map(r => ({
        filePath: r.filePath,
        similarity: Number(r.similarity).toFixed(3),
    }));
}
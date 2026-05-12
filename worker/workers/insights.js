import prisma from "../../api/lib/prisma.js";
import { chatJSON } from "../../api/services/openAI.js";                                                                                            
  
export const processInsights = async (job) => {
    try {
        const snapshot = await prisma.snapshot.findUnique({
            where: { id: job.data.snapshotId },
            select: { id: true, repoId: true, healthScore: true, complexity: true, vulnCount: true, deadCode: true, coverage: true, driftScore: true }
        });

        const messages = [
            {
                role: 'user',
                content: `Given the following code health metrics for a repository, identify the top 3 risks and suggest improvements. Also provide a recommended next action for the development team.

                - Health Score: ${snapshot.healthScore}
                - Complexity: ${snapshot.complexity}
                - Vulnerability Count: ${snapshot.vulnCount}
                - Dead Code Percentage: ${snapshot.deadCode}%
                - Test Coverage: ${snapshot.coverage}%
                - Drift Score: ${snapshot.driftScore}

                Return your response in JSON format with keys "topRisks" (array of strings), "improvements" (array of strings), and "nextAction" (string).`
            }
        ];

        const hint = "You are a helpful assistant that analyzes code health metrics and provides insights to improve code quality.";

        const result = await chatJSON(messages, hint);

        await prisma.insight.create({
            data: {
                snapshotId: snapshot.id,
                topRisks: result.topRisks,
                improvements: result.improvements,
                nextAction: result.nextAction,
                model: process.env.OPENAI_INSIGHTS_MODEL ?? 'gpt-4o-mini',
                tokensIn: 0,   // fine for now
                tokensOut: 0,
            }
        });
    } catch (error) {
        console.error("Error processing insights:", error);
        await prisma.insight.create({
            data: {
                snapshotId: job.data.snapshotId,
                topRisks: [],
                improvements: [],
                nextAction: '',
                model: 'fallback',
                tokensIn: 0,
                tokensOut: 0,
            }
        });
    }
    
}
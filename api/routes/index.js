import webhookRouter from './webhook.js';
import reposRouter from './repos.js';
import analyzeRouter from './analyze.js';
import installRouter from './install.js';
import demoRouter from './demo.js';
import insightsRouter from './insights.js';
import chatRouter from './chat.js';
import rootCauseRouter from './Agents/root-cause.js';
import debateRouter from './Agents/debate.js';
import tourRouter from './Agents/tour.js';
import findingsRouter from './findings.js';
import clustersRouter from './clusters.js';
import filesRouter from './files.js';
import apiKeysRouter from './apiKeys.js';
import settingsRouter from './settings.js';
import badgeRouter from './badge.js';
import searchRouter from './search.js';
import stripeRouter from './stripe.js';
import prIntegrationRouter from './integrations/pr.js';

const constructMethod = (app) => {
    // Routes
    app.use('/api', reposRouter);
    app.use('/api', analyzeRouter);
    app.use('/api', demoRouter);
    app.use('/api/snapshots', insightsRouter);
    app.use('/api', chatRouter);
    app.use('/api', rootCauseRouter);
    app.use('/api', debateRouter);
    app.use('/api', tourRouter);
    app.use('/api', findingsRouter);
    app.use('/api', filesRouter);
    app.use('/api', apiKeysRouter);
    app.use('/api', settingsRouter);
    app.use('/api', clustersRouter);
    // app.use('/api/public', badgeRouter);
    app.use('/api', searchRouter);
    app.use('/api', stripeRouter);
    app.use('/api', prIntegrationRouter);
    // app.use("/api/public", reposRouter); // for GitHub App readme links — public endpoint for fetching repo+snapshot by owner/name
};

export default constructMethod; 
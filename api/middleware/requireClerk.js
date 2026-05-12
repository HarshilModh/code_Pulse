import { verifyToken } from "@clerk/backend";

export async function requireClerk(req, res, next) {                                                                                                                                  
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing auth token' });                                                                                                                     
    }
    const token = authHeader.slice(7);                                                                                                                                                  
    try {         
      const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });                                                                                                                                   
      req.userId = payload.sub;
      next();                                                                                                                                                                           
    } catch (err) {
      console.error('[requireClerk] token:', token?.slice(0, 20), 'error:', err.message);
      res.status(401).json({ error: 'Invalid auth token' });
    }                                                                                                                                                                                   
  }
         

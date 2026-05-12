import express from 'express';
import prisma from '../lib/prisma.js';
import crypto from 'crypto';

const router = express.Router();

router.get('/settings/api-keys', async (req, res) => {
   const keys = await prisma.apiKey.findMany({                                                                                                
      where: { userId: req.userId },                                                                                                           
      orderBy: { createdAt: 'desc' },
      // never return the raw key after creation — only the prefix for identification                                                          
      select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true },                                                       
    })                                                                                                                                         
    res.json(keys)                                                                                                                             
  })  

router.post('/settings/api-keys', async (req, res) => {
    const { name } = req.body;
    if (!name|| name.trim() === '') {
        return res.status(400).json({ error: 'Name is required' });
    }
    const raw = `cp_${crypto.randomBytes(32).toString('hex')}`
    const hashed = crypto.createHash('sha256').update(raw).digest('hex')                                                                       
    const prefix = raw.slice(0, 10) // e.g. "cp_a1b2c3d4" — shown in UI for identification                                                     
                                                                                                                                               
    const key = await prisma.apiKey.create({                                                                                                   
      data: {                                                                                                                                  
        userId: req.userId,                                 
        name: name.trim(),
        key: hashed,   // store only the hash — raw key is returned once and then unrecoverable                                                
        prefix,                                                                                                                                
      },                                                                                                                                       
    })                                                                                                                                         
                                                            
    // Return the raw key in the response — this is the only time it will ever be visible                                                      
    res.status(201).json({ id: key.id, name: key.name, prefix, key: raw })
  })                                                                                                                                           
                                                            
  router.delete('/settings/api-keys/:id', async (req, res) => {                                                                                
    const key = await prisma.apiKey.findUnique({
      where: { id: req.params.id },                                                                                                            
    })                                                      
    if (!key || key.userId !== req.userId) {
      return res.status(404).json({ error: 'API key not found' })                                                                              
    }
    await prisma.apiKey.delete({ where: { id: req.params.id } })                                                                               
    res.status(204).end()                                   
  })                                                                                                                                           
   
  export default router; 
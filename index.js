const express = require('express');
require("dotenv").config()
const cors = require('cors');
const app = express();
const port = 8000;
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000',
    credentials: true
}));



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
const uri = process.env.DB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const JWKS =createRemoteJWKSet(
  new URL (`${process.env.BETTER_AUTH_URL}/api/auth/jwks`)
);

const verifyToken = async (req,res,next)=>{
  const authHeader = req.headers.authorization;
  if (!authHeader){
    return res.status(401).json({message:"Unauthorized access"});
  }
  const token = authHeader.split(" ")[1];
if(!token){
  return res.status(401).json({message:"Unauthorized access"});
}
jwtVerify(token,JWKS)
.then((result)=>{
  req.decoded = result.payload;
  next();
})
.catch((err)=>{
  return res.status(401).json({message:"Unauthorized access"})
});

};

const verifyEmail = (req,res,next)=>{
  if (req.params.email && req.decoded.email !== req.params.email){
    return res.status(403).json({message:"forbidden access"});
  }
  next();
}


async function server() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

 const db= client.db("petAdoption");
 const petsCollection=db.collection("pets");
 const adoptionsCollection = db.collection("adoptions")

 app.get('/pets',async (req,res)=>{
  const{search,species} = req.query;
  let query ={};

  if(search){
    query.petName = {$regex:search, $options: "i"};
  }
  if(species && species !=="All"){
    const speciesArray = species.split(",");
    query.species={$in:speciesArray};
  }

  const cursor= petsCollection.find(query);
  const result =await cursor.toArray();
  res.send(result);
 })

 app.get('/pets/:id',async(req,res)=>{
  const {id}= req.params;
  const query = {_id:new ObjectId(id)}
  const result = await petsCollection.findOne(query)
  res.send(result)

 }) 

 app.get('/pets/owner/:email', verifyToken,verifyEmail, async(req,res)=>{
  // const email = req.params.email;
  const query = {ownerEmail:req.params.email};
  const result = await petsCollection.find(query).toArray();
  res.send(result)
 })

 app.post('/pets',verifyToken, async(req,res)=>{
  const petData = req.body;
  const newPet = {
    ...petData,
    ownerEmail:req.decoded.email,
    status:"available",
    createdAt:new Date()
  };
  const result = await petsCollection.insertOne(newPet)
  res.status(201).send({success:true, message: "Pet added successfully!", insertedId:result.insertedId});
 })

 app.post('/adoptions', async (req,res)=>{
  const adoptionData = req.body;
  const pet = await petsCollection.findOne({_id: new ObjectId(adoptionData.petId)});
if (!pet){
  return res.status(404).send({ message:"pet not found"});
}
if( pet.ownerEmail === req.decoded.email){
  return res.status(403).send({message:"you cannot adopt you own pet"});
}
if(pet.status === "adopted"){
  return res.status(400).send({ message:"this pet is already adopted"})
}
  const newRequest = {
    ...adoptionData,
    userEmail:req.decoded.email,
    status:"pending",
    createdAt:new Date()
  };
const result = await adoptionsCollection.insertOne(newRequest);
res.status(201).send({success:true, insertedId: result.insertedId});
 });

 

 app.get('/adoptions/pet/:petId',async(req,res)=>{
  const petId = req.params.petId;
  const result = await adoptionsCollection.find({petId}).toArray();
  res.send(result);
 })

 app.patch('/adoptions/:id',async(req,res)=>{
  const id = req.params.id;
  const{status,petId} = req.body;

  const result = await adoptionsCollection.updateOne(
    {_id: new ObjectId(id)},
    {$set:{status}}
  );
  if(status === "approved"){
    await petsCollection.updateOne(
      {_id:new ObjectId(petId)},
      {$set:{status:"adopted"}}
    );
    await adoptionsCollection.updateMany(
      {petId,_id:{$ne:id},status:"pending"},
      {$set:{status:"rejected"}}
    );
  }
  res.send(result);
 })

 app.get('/adoptions/user/:email',async(req,res)=>{
  const email = req.params.email;
  const result = await adoptionsCollection.find({userEmail:email}).toArray();
  res.send(result);
 })
 app.delete('/adoptions/:id',async(req,res)=>{
  const id = req.params.id;
  const result=await adoptionsCollection.deleteOne({_id:new ObjectId(id)});
  res.send(result);
 })

 app.patch('/pets/:id',verifyToken, async(req,res)=>{
  const id = req.params.id;
  const pet= await petsCollection.findOne({_id:new ObjectId(id)});
  if(!pet){
    return res.status(404).send({message:"prt not found"});
  }
  if (pet.ownerEmail !== req.decoded.email){
    return res.status(403).send({message:"forbidden access"});
  }
  const updatedData = req.body;
  const result = await petsCollection.findOneAndUpdate(
    { _id:new ObjectId(id)},
    {$set:updatedData},
    { returnDocument:'after'}
  );
  res.send(result);
 })

 app.delete('/pets/:id',verifyToken,async(req,res)=>{
  const id = req.params.id;
  const pet = await petsCollection.findOne({_id: new ObjectId(id)});
  if(!pet){
    return res.status(404).send({message:"prt not found"});
  }
  if (pet.ownerEmail !== req.decoded.email){
    return res.status(403).send({message:"forbidden access"});
  }
  await adoptionsCollection.deleteMany({petId:id});
  const result = await petsCollection.deleteOne({_id:new ObjectId(id)});
  res.send(result);
 })

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
server().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
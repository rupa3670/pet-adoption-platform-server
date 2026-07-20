const express = require('express');
require("dotenv").config()
const cors = require('cors');
const app = express();
const port = 8000;
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = process.env.DB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

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
  const query = {_id:id}
  const result = await petsCollection.findOne(query)
  res.send(result)

 }) 

 app.get('/pets/owner/:email', async(req,res)=>{
  const email = req.params.email;
  const query = {ownerEmail:email};
  const result = await petsCollection.find(query).toArray();
  res.send(result)
 })

 app.post('/adoptions', async (req,res)=>{
  const adoptionData = req.body;
  const newRequest = {
    ...adoptionData,
    status:"pending",
    createAt:new Date()
  };
const result = await adoptionsCollection.insertOne(newRequest);
res.status(201).send({success:true, insertedId: result.insertedId});
 });

 app.post('/pets',async(req,res)=>{
  const petData = req.body;
  const newPet = {
    ...petData,
    createdAt:new Date()
  };
  const result = await petsCollection.insertOne(newPet)
  res.status(201).send({success:true, message: "Pet added successfully!", insertedId:result.insertedId});
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
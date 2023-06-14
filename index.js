const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();

const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


//middleware
app.use(cors());
app.use(express.json())


const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY)


const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access token' })
    }

    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next()

    })

}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.j5l9lxb.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {


        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();



        const usersCollection = client.db("powerplayFusionEdge").collection("users");
        const addClassesCollection = client.db("powerplayFusionEdge").collection("addClasses");
        const selectedClassCollection = client.db("powerplayFusionEdge").collection("selectedClassCollection");
        const paymentCollection = client.db("powerplayFusionEdge").collection("paymentCollection");
        const enrolledClassCollection = client.db("powerplayFusionEdge").collection("enrolledClassCollection");


        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.JWT_ACCESS_TOKEN_SECRET, { expiresIn: '7d' })

            res.send({ token })
        })


        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }



        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }




        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            // console.log(result)
            res.send(result)
        })


        app.post('/users', async (req, res) => {
            const user = req.body;
            // console.log(user);
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user already exist', existingUser })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })


        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id)
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result)

        })


        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id)
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'instructor'
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result)

        })










        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result)
        })


        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' }
            res.send(result)
        })


        // instructor related api
        app.get('/instructors', async (req, res) => {
            const query = { role: "instructor" };
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        })



        app.post('/addClasses', async (req, res) => {
            const newClass = req.body;
            // console.log(newClass)
            const result = await addClassesCollection.insertOne(newClass);
            res.send(result);
        })




        app.get('/addClasses', async (req, res) => {
            const result = await addClassesCollection.find().toArray();
            // console.log(result)
            res.send(result)
        })




        app.patch('/addClasses/:id', async (req, res) => {
            const id = req.params.id;
            const status = req.query.status;
            // console.log(id)
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: status,
                },
            };
            const result = await addClassesCollection.updateOne(filter, updateDoc);
            res.send(result)

        })


        app.put('/addClasses/:id', async (req, res) => {
            const id = req.params.id;
            const feedback = req.body.feedback; // Assuming the new seat value is provided in the request body

            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $push: { feedback: feedback } // Push the new seat value to the "availableSeats" array field
            };

            const result = await addClassesCollection.updateOne(filter, updateDoc);
            res.send(result);
        })








        app.post('/selectedClass', async (req, res) => {
            const selectedClass = req.body;
            // console.log(selectedClass)
            const result = await selectedClassCollection.insertOne(selectedClass);
            res.send(result);
        })


        app.get('/selectedClass', async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            // console.log(decodedEmail)
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            const query = { email: email }
            const result = await selectedClassCollection.find(query).toArray();
            res.send(result)
        })

        app.delete('/selectedClass/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await selectedClassCollection.deleteOne(query);
            res.send(result);
        })


        //single selected class for student
        app.get("/selectedClass/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await selectedClassCollection.findOne(query);
            res.send(result);
        });



        // classes of instructor
        app.get('/instructorClass', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            const query = { instructorEmail: email }
            const result = await addClassesCollection.find(query).toArray();
            res.send(result);
        })



        // create payment intent
        app.post("/create-payment-intent", verifyJWT, async (req, res) => {
            const { classPrice } = req.body;
            const amount = parseInt(classPrice * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });









        // payment  post method 
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            console.log(payment)
            const insertResult = await paymentCollection.insertOne(payment);

            const selectedQuery = { _id: new ObjectId(payment.selectedClassId) }
            const enrolledQuery = { _id: new ObjectId(payment.enrolledClassId) }
            const enrolledClass = await addClassesCollection.findOne(enrolledQuery);
            console.log(enrolledClass)
            // insert enrolled class to enrolled collection 
            const newEnrolledClass = {
                classId: payment.enrolledClassId,
                userEmail: payment.email,
                className: payment.enrolledClassName,
                classImage: payment.enrolledClassImage,
                status: 'paid'
            }
            // console.log(newEnrolledClass)
            const insertEnrolled = await enrolledClassCollection.insertOne(newEnrolledClass);
            // update data of class info after enrolled
            const updateDoc = {
                $set: {
                    enrolled: parseInt(enrolledClass.enrolled + 1),
                    availableSeats: parseInt(enrolledClass.availableSeats - 1)
                },
            };
            const result = await addClassesCollection.updateOne(enrolledQuery, updateDoc);
            // after all done delete the class from selected collection
            const deleteResult = await selectedClassCollection.deleteOne(selectedQuery);
            res.send(insertResult);
        })




        // enrolled class related api
        app.get('/enrolledClass', verifyJWT, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            console.log(req.decoded)
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }

            const query = { userEmail: email };
            const result = await enrolledClassCollection.find(query).toArray();
            res.send(result);
        });



        // payment history api
        app.get('/studentsPaymentsHistory', verifyJWT, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            console.log(decodedEmail)
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }

            const query = { email: email };
            const paymentHistory = await paymentCollection.find(query).sort({ date: -1 }).toArray();
            res.send(paymentHistory);
        });






        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    }



    finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}

run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Khaled Mahmud Sujon  is sitting in the restaurant')
})

app.listen(port, () => {
    console.log(`Khaled Mahmud Sujon is sitting in the port ${port}`)
})
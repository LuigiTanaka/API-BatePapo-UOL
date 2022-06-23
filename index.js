import express from "express";
import cors from "cors";
import chalk from "chalk";
import dotenv from "dotenv";
dotenv.config();

import { MongoClient } from "mongodb";

const app = express();
app.use(cors());
app.use(express.json());

let db = null;
const mongoClient = new MongoClient(process.env.URL_CONNECT_MONGO);
const promise = mongoClient.connect();
promise.then(() => {
    db = mongoClient.db("UOL");
});

app.get("/participants", async (req, res) => {
    try {
        const participantes = await db.collection("participantes").find().toArray();
        res.send(participantes);
    } catch (error) {
        res.status(500).send("Ocorreu algum problema ao tentar buscar os participantes");
    }
})




app.listen(5000, () => {
    console.log(chalk.bold.blue("Ta rodando!"));
});
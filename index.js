import express from "express";
import cors from "cors";
import chalk from "chalk";
import dayjs from "dayjs";
import joi from "joi";
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
    db = mongoClient.db("banco-UOL");
});

app.post("/participants", async (req, res) => {
    const { name } = req.body;

    const userSchema = joi.object({ name: joi.string().required() });
    const validacao = userSchema.validate(req.body);
    if(validacao.error) {
        res.status(422).send("nome inválido");
        return;
    }

    try {
        const participantes = await db.collection("participantes").find().toArray();
        if(participantes.some(participante => participante.name === name)) {
            res.status(409).send("nome já existente");
            return;
        }

        await db.collection("participantes").insertOne({
            name,
            lastStatus: Date.now()
        });

        await db.collection("mensagens").insertOne({
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs().format('HH:mm:ss')
        });

        res.status(201).send("participante criado!");

    } catch (error) {
        res.status(500).send("Ocorreu algum problema ao tentar criar o participante");
    }
})

app.get("/participants", async (req, res) => {
    try {
        const participantes = await db.collection("participantes").find().toArray();
        res.status(200).send(participantes);
    } catch (error) {
        res.status(500).send("Ocorreu algum problema ao tentar buscar os participantes");
    }
});

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const from = req.headers.user;

    const messageSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message').valid('private_message'),
        //falta verificar o from direitinho
        from: joi.string()
    });

    const mensagem = { 
        to,
        text, 
        type, 
        from 
    };

    const validacao = messageSchema.validate(mensagem);
    if(validacao.error) {
        res.status(422).send("mensagem inválida");
        return;
    }

    try {
        await db.collection("mensagens").insertOne({
            from,
            to,
            text,
            type,
            time: dayjs().format('HH:mm:ss')
        });

        res.status(201).send("mensagem criada!");
    } catch (error) {
        res.status(500).send("Ocorreu algum problema ao tentar criar a mensagem");
    }
});

app.get("/messages", async (req, res) => {
    try {
        const mensagens = await db.collection("mensagens").find().toArray();
        res.status(200).send(mensagens);
    } catch (error) {
        res.status(500).send("Ocorreu algum problema ao tentar buscar as mensagens");
    }
});



app.listen(5000, () => {
    console.log(chalk.bold.blue("Ta rodando!"));
});
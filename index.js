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
    if (validacao.error) {
        res.status(422).send("nome inválido");
        return;
    }

    try {
        const participantes = await db.collection("participantes").find().toArray();
        if (participantes.some(participante => participante.name === name)) {
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

    try {
        const participantes = await db.collection("participantes").find().toArray();
        const nomeParticipantes = participantes.map(participante => participante.name);

        const messageSchema = joi.object({
            to: joi.string().required(),
            text: joi.string().required(),
            type: joi.string().valid('message').valid('private_message'),
            from: joi.string().valid(...nomeParticipantes)
        });
    
        const mensagem = {
            to,
            text,
            type,
            from
        };
    
        const validacao = messageSchema.validate(mensagem);
        if (validacao.error) {
            res.status(422).send("mensagem inválida");
            return;
        }
    } catch (error) {
        res.status(500).send("Ocorreu algum problema ao tentar validar a mensagem");
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
    const limite = parseInt(req.query.limit);
    const nomeUsuario = req.headers.user;

    try {
        const mensagens = await db.collection("mensagens").find().toArray();

        const mensagensFiltradas = mensagens.filter(mensagem => {
            if (mensagem.type === "status" || mensagem.type === "message") {
                return mensagem;
            } else if (mensagem.from === nomeUsuario || mensagem.to === nomeUsuario) {
                return mensagem;
            }
        });

        if (!limite) {
            res.status(200).send(mensagensFiltradas);
            return;
        }

        const fim = mensagensFiltradas.length;
        const inicio = fim - limite;
        res.status(200).send(mensagensFiltradas.slice(inicio, fim));
    } catch (error) {
        res.status(500).send("Ocorreu algum problema ao tentar buscar as mensagens");
    }
});

app.post("/status", async (req, res) => {
    const nomeUsuario = req.headers.user;
    try {
        const usuarioAtivo = await db.collection("participantes").findOne({ name: nomeUsuario });

        if (!usuarioAtivo) {
            res.status(404).send("usuario inativo");
        }

        await db.collection("participantes").updateOne({
            _id: usuarioAtivo._id
        }, { $set: { lastStatus: Date.now() } });

        res.status(200).send("status do participante atualizado!")
    } catch (error) {
        res.status(500).send("Ocorreu algum problema ao tentar atualizar o status do usuario");
    }
});

async function removerUsuariosInativos() {
    const participantes = await db.collection("participantes").find().toArray();
    participantes.forEach(async participante => {
        const tempoInativo = Date.now() - participante.lastStatus;
        if(tempoInativo > 10000) {
            await db.collection("participantes").deleteOne({ _id: participante._id });
            await db.collection("mensagens").insertOne({
                from: participante.name,
                to: 'Todos', 
                text: 'sai da sala...', 
                type: 'status', 
                time: dayjs().format('HH:mm:ss')
            });
        }
    });
}

setInterval(removerUsuariosInativos, 15000);

app.listen(5000, () => {
    console.log(chalk.bold.blue("Ta rodando!"));
});
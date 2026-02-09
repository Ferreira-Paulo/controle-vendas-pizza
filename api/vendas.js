import admin from "firebase-admin";

function initFirebase() {
  if (admin.apps.length) return;

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // IMPORTANTÍSSIMO: manter esse replace do \n
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

function checkPin(req) {
  const pin = req.headers["x-pin"];
  return pin && pin === process.env.CLUB_PIN;
}

export default async function handler(req, res) {
  try {
    if (!checkPin(req)) {
      return res.status(401).json({ error: "PIN inválido" });
    }

    initFirebase();
    const db = admin.firestore();
    const col = db.collection("vendas_pizza");

    // GET /api/vendas
    if (req.method === "GET") {
      const snap = await col.orderBy("createdAt", "desc").limit(500).get();
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.status(200).json(data);
    }

    // POST /api/vendas
    if (req.method === "POST") {
      const body = req.body || {};
      const doc = {
        vendedor: (body.vendedor || "").trim(),
        comprador: (body.comprador || "").trim(),
        sabor: body.sabor || "",
        telefone: (body.telefone || "").trim(),
        retirou: body.retirou === "sim" ? "sim" : "nao",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (!doc.vendedor || !doc.comprador || !doc.sabor) {
        return res.status(400).json({ error: "Campos obrigatórios faltando" });
      }

      const ref = await col.add(doc);
      return res.status(201).json({ id: ref.id });
    }

    // PUT /api/vendas?id=DOC_ID
    if (req.method === "PUT") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id é obrigatório" });

      const body = req.body || {};
      const patch = {
        vendedor: (body.vendedor || "").trim(),
        comprador: (body.comprador || "").trim(),
        sabor: body.sabor || "",
        telefone: (body.telefone || "").trim(),
        retirou: body.retirou === "sim" ? "sim" : "nao",
      };

      await col.doc(id).update(patch);
      return res.status(200).json({ ok: true });
    }

    // DELETE /api/vendas?id=DOC_ID
    if (req.method === "DELETE") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id é obrigatório" });

      await col.doc(id).delete();
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Método não permitido" });
  } catch (err) {
    return res.status(500).json({ error: "Erro no servidor", details: String(err?.message || err) });
  }
}

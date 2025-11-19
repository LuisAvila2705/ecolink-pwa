export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (email === "test@demo.com" && password === "123456") {
      return res.status(200).json({ message: "Login exitoso", token: "fake_token_123" });
    }
    return res.status(401).json({ error: "Credenciales incorrectas" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error en el servidor" });
  }
};

class Login {
    constructor(email, senha) {
        this.email = email;
        this.senha = senha;
    }

    MostraDados() {
        return `${this.email} ${this.senha}`;
    }


}

const senhaInput = document.getElementById("password");
const error = document.getElementById("erro");

senhaInput.addEventListener("input", () => {
    if (senhaInput.value.trim().length < 10) {
        error.innerHTML = "A senha deve ter no mínimo 10 caracteres.";
        error.style.color = "red";
    } else {
        error.innerHTML = "";
    }
});


function Logado() {

    const EmailDigitado = document.getElementById("email").value.trim();
    const senhaDigitada = document.getElementById("password").value.trim();
    const error = document.getElementById("erro");


    if (!EmailDigitado || !senhaDigitada) {
        alert("nao pode haver campos vazios");

        return;
    }




    const usuario = new Login(EmailDigitado, senhaDigitada);


    const divResultado = document.getElementById('msg');
    divResultado.innerHTML = "Bem vindo de volta!!";
    divResultado.style.color = "green";
    divResultado.style.fontFamily = "sans-serif";
    divResultado.style.fontWeight = "300"

}
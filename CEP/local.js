function BuscarCep() {
        let campoText = document.getElementById("cep").value;

        const xana = new XMLHttpRequest();//metodo de fazer requisiçao a um site sem precisar acessa o site no navegador
        xana.open('GET', 'https://viacep.com.br/ws/' + campoText + '/json/');
        xana.send();

        xana.onload = function () {

                let obj = JSON.parse(this.responseText);

                let logradouro = obj.logradouro;
                let bairro = obj.bairro;
                let localidade = obj.localidade;
                let regiao = obj.regiao;

                document.getElementById("Logradouro").innerHTML = "Logradouro: " + obj.logradouro + "<br>";
                document.getElementById("Bairro").innerHTML = "Bairro: " + obj.bairro + "<br>";
                document.getElementById("Localidade").innerHTML = "Localidade: " + obj.localidade + "<br>";
                document.getElementById("UF").innerHTML = "UF: " + obj.uf;

        }
}

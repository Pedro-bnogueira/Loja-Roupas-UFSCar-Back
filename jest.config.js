module.exports = {
    // Exibe o nome de cada teste conforme eles são executados
    verbose: true,

    // Retira os console.log durante a execução dos testes
    // silent: true,
    
    // Define o ambiente de testes para Node.js
    testEnvironment: 'node',
  
    // Especifica as raízes onde os testes serão procurados
    roots: ["<rootDir>/tests"],
  
    // Coleta informações de cobertura de teste e salva no diretório "coverage"
    collectCoverage: true,
    coverageDirectory: "coverage",
  };
  
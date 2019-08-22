pipeline {
  agent {
    label 'mongoose'
  }
  stages {
    stage('Build') {
      steps {
        echo 'Building..'
        sh 'sh ./tools/install-yoda-cli.sh'
      }
    }
    stage('Test') {
      steps {
        echo 'Testing..'
      }
    }
  }
}

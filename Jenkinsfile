pipeline {
  agent {
    label "mongoose"
  }
  stages {
    stage("Run tests") {
      steps {
        echo "Building.."
        withEnv(["PATH+EXTRA=/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/bin"]) {
          sh "./tools/install-yoda-cli.sh"
          sh "./tools/unit-test.sh"
        }
      }
    }
  }
}

pipeline {
  agent {
    label "mongoose"
  }
  stages {
    stage("Build") {
      steps {
        echo "Building.."
        withEnv(["PATH+EXTRA=/usr/sbin:/usr/bin:/sbin:/bin"]) {
          sh "./tools/install-yoda-cli.sh"
        }
      }
    }
  }
}

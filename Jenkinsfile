
pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    stages {
        stage('Initialize') {
            steps {
                echo 'Starting Medical Office CRM Jenkins pipeline'
                echo "Branch: ${env.BRANCH_NAME ?: 'manual'}"
            }
        }

        stage('Environment Check') {
            steps {
                sh 'java -version'
                sh 'pwd'
            }
        }
    }

    post {
        success {
            echo 'Jenkins pipeline completed successfully.'
        }

        failure {
            echo 'Jenkins pipeline failed.'
        }
    }
}

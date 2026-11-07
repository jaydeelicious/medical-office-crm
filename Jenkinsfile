
pipeline {
    agent {
        label 'medicaloffice-linux'
    }

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

        
        stage('Verify .NET SDK') {
            steps {
                sh 'dotnet --info'
            }
        }

        stage('Backend Restore') {
            steps {
                sh 'dotnet restore medical-office-crm.slnx'
            }
        }

        stage('Backend Build') {
            steps {
                sh 'dotnet build medical-office-crm.slnx --no-restore --configuration Release'
            }
        }

        stage('Backend Tests') {
            steps {
                withCredentials([
                    string(
                        credentialsId: 'medicaloffice-jenkins-sql-password',
                        variable: 'SQL_PASSWORD'
                    )
                ]) {
                    sh '''
                        set +x

                        export MEDICALOFFICE_TEST_SQL_CONNECTION="Server=medicaloffice-jenkins-sql,1433;User Id=sa;Password=${SQL_PASSWORD};Encrypt=True;TrustServerCertificate=True;"

                        dotnet test medical-office-crm.slnx \
                            --no-build \
                            --configuration Release
                    '''
                }
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

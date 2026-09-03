pipeline {
    agent any

    stages {

        stage('Checkout') {
            steps {
                git 'https://github.com/Anitha-110/cloud-native-tetris.git'
            }
        }

        stage('Build Backend Image') {
            steps {
                sh '''
                cd backend
                docker build -t tetris-backend:latest .
                '''
            }
        }

        stage('Build Frontend Image') {
            steps {
                sh '''
                docker build -t tetris-frontend:latest .
                '''
            }
        }

        stage('Docker Images') {
            steps {
                sh 'docker images | grep tetris'
            }
        }
    }
}

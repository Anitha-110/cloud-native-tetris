pipeline {
    agent any

    environment {
        KUBECONFIG = '/var/lib/jenkins/kubeconfig'
    }

    stages {

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

        stage('Import Images to Kubernetes') {
            steps {
                sh '''
                docker save tetris-backend:latest | sudo ctr -n k8s.io images import -
                docker save tetris-frontend:latest | sudo ctr -n k8s.io images import -
                '''
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                sh '''
                kubectl apply -f mysql.yaml
                kubectl apply -f backend.yaml
                kubectl apply -f frontend.yaml
                '''
            }
        }

        stage('Check Deployment') {
            steps {
                sh '''
                kubectl get pods -n tetris
                kubectl get svc -n tetris
                '''
            }
        }
    }
}

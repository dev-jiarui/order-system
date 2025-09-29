pipeline {
    agent any
    
    environment {
        // 镜像相关配置
        IMAGE_NAME = 'order-system'
        IMAGE_TAG = "${env.BUILD_NUMBER}"
        DOCKER_REGISTRY = 'your-registry-url' // 替换为实际的Docker Registry
    }
    
    stages {
        stage('代码检出') {
            steps {
                checkout scm
            }
        }
        
        stage('安装依赖') {
            steps {
                sh 'npm install'
            }
        }
        
        stage('构建Docker镜像') {
            steps {
                sh "docker build -t ${IMAGE_NAME}:${IMAGE_TAG} ."
                sh "docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
                sh "docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${DOCKER_REGISTRY}/${IMAGE_NAME}:latest"
            }
        }
        
        stage('推送镜像') {
            steps {
                sh "docker push ${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
                sh "docker push ${DOCKER_REGISTRY}/${IMAGE_NAME}:latest"
            }
        }
        
        stage('部署到开发环境') {
            when {
                branch 'develop'
            }
            steps {
                sh 'echo "部署到开发环境"'
                sh 'ssh user@dev-server "docker pull ${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG} && docker-compose -f docker-compose.yml up -d"'
            }
        }
        
        stage('部署到测试环境') {
            when {
                branch 'test'
            }
            steps {
                sh 'echo "部署到测试环境"'
                sh 'ssh user@test-server "docker pull ${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG} && docker-compose -f docker-compose.yml up -d"'
            }
        }
        
        stage('部署到生产环境') {
            when {
                branch 'main' || branch 'master'
            }
            steps {
                sh 'echo "部署到生产环境"'
                // 生产环境可以添加人工确认步骤
                input message: '是否确认部署到生产环境？', ok: '确认部署'
                sh 'ssh user@prod-server "docker pull ${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG} && docker-compose -f docker-compose.yml up -d"'
            }
        }
    }
    
    post {
        success {
            echo '构建和部署成功！'
            // 可以添加通知逻辑，如发送邮件
        }
        failure {
            echo '构建或部署失败！'
            // 可以添加失败通知逻辑
        }
        always {
            // 清理工作
            sh 'echo "清理工作空间"'
        }
    }
}
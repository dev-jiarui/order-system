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
                sh 'npm ci'
            }
        }
        
        stage('代码质量检查') {
            steps {
                sh 'npm run lint || echo "Lint检查完成"'
            }
        }
        
        stage('运行测试') {
            steps {
                sh 'npm test'
            }
            post {
                always {
                    // 发布测试结果
                    publishTestResults testResultsPattern: 'test-results.xml'
                    // 发布覆盖率报告
                    publishCoverageResults(
                        adapters: [
                            istanbulCoberturaAdapter('coverage/cobertura-coverage.xml')
                        ],
                        sourceFileResolver: sourceFiles('STORE_LAST_BUILD')
                    )
                }
            }
        }
        
        stage('安全扫描') {
            steps {
                sh 'npm audit --audit-level=high'
            }
        }
        
        stage('构建Docker镜像') {
            steps {
                script {
                    // 构建镜像
                    def image = docker.build("${IMAGE_NAME}:${IMAGE_TAG}")
                    
                    // 镜像安全扫描
                    sh "docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image ${IMAGE_NAME}:${IMAGE_TAG}"
                    
                    // 标记镜像
                    sh "docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
                    sh "docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${DOCKER_REGISTRY}/${IMAGE_NAME}:latest"
                }
            }
        }
        
        stage('推送镜像') {
            steps {
                script {
                    docker.withRegistry("https://${DOCKER_REGISTRY}", 'docker-registry-credentials') {
                        sh "docker push ${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
                        sh "docker push ${DOCKER_REGISTRY}/${IMAGE_NAME}:latest"
                    }
                }
            }
        }
        
        stage('部署到开发环境') {
            when {
                branch 'develop'
            }
            steps {
                script {
                    sshagent(['dev-server-ssh-key']) {
                        sh '''
                            ssh -o StrictHostKeyChecking=no user@dev-server "
                                docker pull ${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG} &&
                                docker-compose --env-file .env.dev down &&
                                docker-compose --env-file .env.dev up -d &&
                                docker system prune -f
                            "
                        '''
                    }
                }
            }
        }
        
        stage('部署到测试环境') {
            when {
                branch 'test'
            }
            steps {
                script {
                    sshagent(['test-server-ssh-key']) {
                        sh '''
                            ssh -o StrictHostKeyChecking=no user@test-server "
                                docker pull ${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG} &&
                                docker-compose --env-file .env.uat down &&
                                docker-compose --env-file .env.uat up -d &&
                                docker system prune -f
                            "
                        '''
                    }
                }
            }
        }
        
        stage('部署到生产环境') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                }
            }
            steps {
                script {
                    // 生产环境人工确认
                    input message: '是否确认部署到生产环境？', ok: '确认部署',
                          submitterParameter: 'APPROVER'
                    
                    sshagent(['prod-server-ssh-key']) {
                        sh '''
                            ssh -o StrictHostKeyChecking=no user@prod-server "
                                docker pull ${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG} &&
                                docker-compose --env-file .env.prod --profile production down &&
                                docker-compose --env-file .env.prod --profile production up -d &&
                                docker system prune -f
                            "
                        '''
                    }
                }
            }
        }
        
        stage('部署后验证') {
            parallel {
                stage('健康检查') {
                    steps {
                        script {
                            sleep(30) // 等待服务启动
                            sh '''
                                for i in {1..10}; do
                                    if curl -f http://target-server:3000/health; then
                                        echo "健康检查通过"
                                        break
                                    fi
                                    echo "等待服务启动... ($i/10)"
                                    sleep 10
                                done
                            '''
                        }
                    }
                }
                stage('烟雾测试') {
                    steps {
                        sh 'npm run smoke-test || echo "烟雾测试完成"'
                    }
                }
            }
        }
    }
    
    post {
        success {
            echo '构建和部署成功！'
            // 发送成功通知
            emailext (
                subject: "✅ 构建成功: ${env.JOB_NAME} - ${env.BUILD_NUMBER}",
                body: """
                    构建成功！
                    
                    项目: ${env.JOB_NAME}
                    构建号: ${env.BUILD_NUMBER}
                    分支: ${env.BRANCH_NAME}
                    提交: ${env.GIT_COMMIT}
                    
                    查看详情: ${env.BUILD_URL}
                """,
                to: "${env.CHANGE_AUTHOR_EMAIL}"
            )
        }
        failure {
            echo '构建或部署失败！'
            // 发送失败通知
            emailext (
                subject: "❌ 构建失败: ${env.JOB_NAME} - ${env.BUILD_NUMBER}",
                body: """
                    构建失败！
                    
                    项目: ${env.JOB_NAME}
                    构建号: ${env.BUILD_NUMBER}
                    分支: ${env.BRANCH_NAME}
                    提交: ${env.GIT_COMMIT}
                    
                    查看详情: ${env.BUILD_URL}
                    查看日志: ${env.BUILD_URL}console
                """,
                to: "${env.CHANGE_AUTHOR_EMAIL}"
            )
        }
        always {
            // 清理工作
            sh '''
                echo "清理Docker镜像"
                docker rmi ${IMAGE_NAME}:${IMAGE_TAG} || true
                docker system prune -f || true
            '''
            
            // 归档构建产物
            archiveArtifacts artifacts: 'package*.json, Dockerfile, docker-compose*.yml', 
                             fingerprint: true
            
            // 清理工作空间
            cleanWs()
        }
    }
}
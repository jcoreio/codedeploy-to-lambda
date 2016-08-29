# codepipeline-lambda-updater

Replace a lambda function's code with the output of a CodePipeline build stage

### Setup

- Log into your AWS account's web console, and click "Create a Lambda function"

[ Image 01 ]

- Configure the function:

  - Name: `codePipelineToLambda`
  - Runtime: Node.js 4.3
  - Lambda function code: Select "Edit code inline", and paste the contents of index.js into the editor.
  - Handler: `index.handler`
  - Role: `Create a custom role`

[ Image 02 ]
  
- Configure the role:
  - RoleName: `codePipelineToLambdaRole`
  - Click through Next to finish creating the Lambda function
  
[ Image 03 ]
  

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "codepipeline:PutJobSuccessResult",
        "codepipeline:PutJobFailureResult"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:UpdateFunctionCode"
      ],
      "Resource": [
        "*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:*"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:Get*",
        "s3:List*"
      ],
      "Resource": "*"
    }
  ]
}
```

- Add the Lambda function to your pipeline

  - Navigate in the AWS console to your code pipeline, and click "Edit"
  - Click + Stage and + Action
  - Configure the stage:
    - Action category: `Invoke`
    - Action Name: `DeployToLambda`
    - Provider: AWS Lambda
    - Function name: codePipelineToLambda
    - User parameters: three space-separated strings: `MyAppBuild dist/function.zip destLambdaFunctionName`
      - Input Artifact Name: Name of the CodePipeline input artifact
      - Lambda code location: Subpath within the build artifact for the lambda code file or bundle
      - Destination Lambda function name: Name of the Lambda function whose code will be replaced
    - Input Artifact: `MyAppBuild`
  
  
[ Image 05 ]

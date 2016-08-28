'use strict'

const child_process = require('child_process')
const fs = require('fs')
const path = require('path')

const AWS = require('aws-sdk')

exports.handler = function(event, context) {

  const codepipeline = new AWS.CodePipeline()
  let jobId

  //Notify AWS CodePipeline of a successful job
  function putJobSuccess(message) {
    console.log(message)
    codepipeline.putJobSuccessResult({ jobId },
      (err, data) => {
        if (err)
          context.fail(err)
        else
          context.succeed(message)
      })
  }

  // Notify AWS CodePipeline of a failed job
  function putJobFailure(message) {
    console.error('job failure: ', message)
    codepipeline.putJobFailureResult({
      jobId,
      failureDetails: {
        message: JSON.stringify(message),
        type: 'JobFailed',
        externalExecutionId: context.invokeid
      }
    }, (err, data) => context.fail(message))
  }

  try {
    const jobEvent = event['CodePipeline.job']
    jobId = jobEvent.id
    const jobData = jobEvent.data

    // Retrieve the value of UserParameters from the Lambda action configuration in AWS CodePipeline, in this case a URL which will be
    // health checked by this function.
    const userParams = jobData.actionConfiguration.configuration.UserParameters
    const userParamsSplit = userParams && userParams.split(' ')
    if (!userParams || !userParamsSplit || userParamsSplit.length !== 3)
      throw new Error('The User Parameters field must contain three items separated by spaces: the input artifact name, the location of the lambda function code within the input artifact, and the destination lambda function name')

    const artifactName = userParamsSplit[0]
    const lambdaCodeLoc = userParamsSplit[1]
    const destLambdaFunctionName = userParamsSplit[2]

    const artifact = jobData.inputArtifacts.find(a => a.name === artifactName && a.location.type === 'S3')
    if (!artifact) throw new Error('artifact not found: ', artifactName)

    const s3 = new AWS.S3()
    const tmpDir = path.join('/tmp', context.invokeid)
    if (fs.existsSync(tmpDir))
      child_process.execSync(`rm -rf ${tmpDir}`)
    fs.mkdirSync(tmpDir)

    const artifactZipFilePath = path.join(tmpDir, 'artifact.zip')

    s3.getObject({
      Bucket: artifact.location.s3Location.bucketName,
      Key: artifact.location.s3Location.objectKey
    }, (err, data) => {
      if (err) return putJobFailure(`could not download artifact from S3: ${err.stack || err}`)
      fs.writeFileSync(artifactZipFilePath, data.Body)
      const extractDir = path.join(tmpDir, 'extract')
      fs.mkdirSync(extractDir)
      process.chdir(extractDir)
      child_process.execSync(`unzip ${artifactZipFilePath}`)

      const functionCodeZipFilePath = path.join(extractDir, lambdaCodeLoc)
      const zipFileContents = fs.readFileSync(functionCodeZipFilePath)

      const lambda = new AWS.Lambda()
      lambda.updateFunctionCode({
        FunctionName: destLambdaFunctionName,
        Publish: true,
        ZipFile: zipFileContents
      }, err => {
        if (err) return putJobFailure('could not update lambda function code: ' + (err.stack || err))
        putJobSuccess('lambda code updated')
      })
    })
  } catch (err) {
    putJobFailure(err.stack)
  }
}

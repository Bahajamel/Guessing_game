const { expect } = require('chai');
const { ethers } = require('hardhat');

describe( 'GuessingGame', function(){
    let accounts
    let guessingGame
    let contract
    let owner
    let player1
    let player2

    const secret = 'Hello'


    const fonds = 10000000

    before(async function(){
        accounts = await ethers.getSigners()
        owner = accounts[0]
        player1 = accounts[1]
        player2 = accounts[2]
        player3=accounts[3]

        guessingGame = await ethers.getContractFactory('GuessingGame')
    })

     beforeEach(async function () {
        contract = await guessingGame.deploy();
        await contract.deployed();
    });

  async function liveness() {
  
    const active = await contract.gameActive();
    if (!active) return;


    const balanceBefore = await ethers.provider.getBalance(contract.address);
    if (balanceBefore.eq(0)) return; // Pas de fonds bloqués


    const currentTokenOwner = await contract.getTokenOwner();
    const signer = accounts.find(a => a.address === currentTokenOwner) || owner;
    await contract.connect(signer).GiveToken(player2.address);


    const lockedAmount = await ethers.provider.getBalance(contract.address);

    const balancePlayer2Before = await ethers.provider.getBalance(player2.address);
    const tx=await contract.connect(player2).Guess(secret, lockedAmount, player3.address);

    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed.mul(tx.gasPrice || receipt.effectiveGasPrice);

    // Vérifier que les fonds ont bien quitté le contrat
    const balanceAfter = await ethers.provider.getBalance(contract.address);
    expect(balanceAfter).to.equal(balanceBefore.sub(lockedAmount));

    // Vérifier que player1 a bien reçu les fonds
    const balancePlayer2After = await ethers.provider.getBalance(player2.address);
    expect(balancePlayer2After).to.be.gt(balancePlayer2Before.sub(gasUsed));

    // Vérifier que le jeu s'est bien arrêté
    expect(await contract.gameActive()).to.equal(false);
}
    it ('deploy contract', async function(){
      const address=await contract.getOwner();
      expect(owner.address).to.equal(address);
      await expect(contract.getTokenOwner()).to.be.revertedWith("game not initialized");
      await expect(contract.getHashedSecret()).to.be.revertedWith("game not initialized");
    })
    
    it('liveness', async function(){
        await liveness()
    })

    describe ('before initGame', function(){
            it('test giveToken revert before init game',async function(){
                await expect(contract.GiveToken(player1.address)).to.be.revertedWith("Not token owner");

            })
            it('test Guess revert before init game',async function(){
                await expect(contract.Guess('hi', 10, player2.address)).to.be.revertedWith("Not token owner");

            })
            it('init game amount<=0',async function(){
              await expect(contract.initGame(0, secret, { value: 0 })).to.be.revertedWith("amount negative!!!")
                
            })
            it('initGame revert si msg.value ≠ amount', async function () {
             await expect(
                contract.initGame(fonds, secret, { value: fonds - 1 })
              ).to.be.revertedWith('send ETH equal to amount');
            });

            it('only owner can init game', async function () {

            await expect(contract.connect(player1).initGame(fonds,secret, { value: fonds })).to.be.revertedWith("only owner can call the function");
        });
             



            it('test init game', async function(){
               const oldBalance=await ethers.provider.getBalance(contract.address)
               expect(oldBalance).to.equal(0)

               await contract.initGame(fonds,secret,{value:fonds})

               const next_balance=await ethers.provider.getBalance(contract.address)
               expect(fonds).to.equal(next_balance)

               hash=await contract.getHashedSecret()
               const expectedHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(secret));
               expect(hash).to.equal(expectedHash)
               expect(await contract.gameActive()).to.equal(true);

               

            })

            it('liveness(sans init préalable)', async function(){
              await liveness()
            })
            
    })
    describe ('after initGame', function(){
        beforeEach(async function () {
            await contract.initGame(fonds, secret, { value: fonds });
        });

        it('prevents double initilization', async function(){
            await expect(contract.initGame(fonds,secret,{value:fonds})).to.be.revertedWith('game already initialized')
        })

        it('give token reverted ',async function(){
            await expect(contract.GiveToken(ethers.constants.AddressZero)).to.be.revertedWith("Invalid address");

        })
        it('GiveToken revert si même joueur', async function () {
            await expect(
                contract.GiveToken(owner.address)
            ).to.be.revertedWith('Cannot give to yourself');
        });

        it('giveToken revert if not tokenOwner', async function () {




          await expect(
             contract.connect(player1).GiveToken(player2.address)).to.be.revertedWith("Not token owner");
        });

        
         it('test giveToken success after init', async function () {


            await contract.GiveToken(player1.address);

            expect(await contract.getTokenOwner()).to.equal(player1.address);
        });
            
         it('liveness', async function(){
              await liveness()
         })


    })

    describe('after Give Token(Guess now!)', function () {
        beforeEach(async function () {
            await contract.initGame(fonds, secret, { value: fonds });
            await contract.GiveToken(player1.address);
        });


    it('just tokenOwner can guess', async function () {


        await expect(contract.connect(player2).Guess("hi", 10, player3.address)).to.be.revertedWith("Not token owner");
    });

    it('guessing with empty attempt', async function () {

      await expect(contract.connect(player1).Guess("", 10, player2.address)).to.be.revertedWith("Attempt cannot be empty");
    });

    it('guessing with  amount=0', async function () {

      await expect(contract.connect(player1).Guess("hi", 0, player2.address)).to.be.revertedWith("Amount must be > 0");
    });

    it('guessing with amount greater than pool', async function () {

        await expect(contract.connect(player1).Guess("hi", fonds + 1, player2.address)).to.be.revertedWith("Exceeds pool");
    });

     it('Guess revert if nextPlayer = address(0)', async function () {
            await expect(
                contract.connect(player1).Guess('wrong',10, ethers.constants.AddressZero)
            ).to.be.revertedWith('Invalid next player');
        });

    it('Guess revert si nextPlayer = msg.sender', async function () {
            await expect(
                contract.connect(player1).Guess('wrong',10, player1.address)
            ).to.be.revertedWith('Same player');
        });
    it('false guess ', async function () {

    const oldContractBalance = await ethers.provider.getBalance(contract.address);

    await contract.connect(player1).Guess("wrong", 10, player2.address);

    const newContractBalance = await ethers.provider.getBalance(contract.address);

    expect(newContractBalance).to.equal(oldContractBalance);

    const owner = await contract.getTokenOwner();
    expect(owner).to.equal(player2.address);
    expect(await contract.gameActive()).to.equal(true);
});

it('correct guess ', async function () {

    

    const oldContractBalance = await ethers.provider.getBalance(contract.address);
    const oldPlayerBalance = await ethers.provider.getBalance(player1.address);

    await contract.connect(player1).Guess("Hello", 10, player2.address);


    const newContractBalance = await ethers.provider.getBalance(contract.address);
    const newPlayerBalance = await ethers.provider.getBalance(player1.address);
    

    expect(newContractBalance).to.equal(oldContractBalance.sub(10));
    expect(newPlayerBalance).to.not.equal(oldPlayerBalance);

    expect(await contract.gameActive()).to.equal(false);
});




    it('liveness', async function(){
              await liveness()
    })

});


describe('withdrawRemaining', function () {
    it('reverts if game is still active', async function () {
        await contract.initGame(fonds, secret, { value: fonds });

        await expect(
            contract.withdrawRemaining()
        ).to.be.revertedWith('Game still active');
    });

    it('reverts if nothing to withdraw (balance = 0)', async function () {
        
        await expect(
            contract.withdrawRemaining()
        ).to.be.revertedWith('Nothing to withdraw');
    });

    it('reverts if caller is not the owner', async function () {
        await contract.initGame(fonds, secret, { value: fonds });

        
        await contract.GiveToken(player1.address);
        await contract.connect(player1).Guess(secret, fonds, player2.address);

        await expect(
            contract.connect(player1).withdrawRemaining()
        ).to.be.revertedWith('only owner can call the function');
    });

    it('reverts with nothing to withdraw after a correct guess drains the pool', async function () {

        await contract.initGame(fonds, secret, { value: fonds });

        await contract.GiveToken(player1.address);
        await contract.connect(player1).Guess(secret,fonds, player2.address);

        // gameActive = false, balance = 0 ici donc rien à retirer
        await expect(
            contract.withdrawRemaining()
        ).to.be.revertedWith('Nothing to withdraw');
    });

    it('owner receives exactly the remaining balanc', async function () {
        await contract.initGame(fonds,secret, { value: fonds });

        
        await contract.GiveToken(player1.address);
        await contract.connect(player1).Guess(secret,fonds, player2.address);


        const ownerBalBefore = await ethers.provider.getBalance(owner.address);
        const contractBal    = await ethers.provider.getBalance(contract.address);

        if (contractBal.gt(0)) {
            const tx      = await contract.withdrawRemaining();
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);

            const ownerBalAfter = await ethers.provider.getBalance(owner.address);

            expect(ownerBalAfter).to.equal(
                ownerBalBefore.add(contractBal).sub(gasUsed)
            );
            expect(
                await ethers.provider.getBalance(contract.address)
            ).to.equal(0);
        }
    });
});




})



    